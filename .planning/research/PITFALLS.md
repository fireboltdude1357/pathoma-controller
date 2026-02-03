# Domain Pitfalls: Chrome Extension + Real-time Backend

**Domain:** Remote video playback controller (Chrome extension + Convex backend)
**Researched:** 2026-02-02
**Confidence:** HIGH (verified with official Chrome/Clerk/Convex documentation)

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Service Worker Lifecycle Misunderstanding
**What goes wrong:** Developers assume the service worker stays alive indefinitely and store critical state in global variables. Service workers terminate after 30 seconds of inactivity, causing complete loss of subscription state, pending commands, and active connections.

**Why it happens:** Background scripts in Manifest V2 were persistent. Developers migrating to V3 or building new extensions often don't adapt their mental model to the non-persistent service worker lifecycle.

**Consequences:**
- Convex subscriptions disconnect when service worker terminates
- Command queue lost if stored in memory
- WebSocket connections drop silently
- Extension appears "broken" to users after idle periods

**Prevention:**
- Store ALL state in `chrome.storage.local` or `chrome.storage.session`, never in global variables
- Design subscription management to reinitialize on service worker restart
- Use `chrome.alarms` API for scheduled work, not `setTimeout`/`setInterval` (timers are cancelled on termination)
- Test by manually terminating service worker in `chrome://serviceworker-internals`

**Detection:**
- Extension works immediately after installation but fails after ~30 seconds of inactivity
- Convex subscription stops receiving updates after idle period
- Console shows "Service Worker inactive" in extension inspection

**Phase impact:** Phase 1 (Basic Command Execution) - Architecture must be designed for ephemeral service workers from day one.

**Source confidence:** HIGH - [Chrome Extension Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle), [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers)

---

### Pitfall 2: Message Passing Async Response Failure
**What goes wrong:** Content script sends message to service worker, expects response, but gets `undefined` or no response. Service worker's async handler completes successfully but response never reaches content script.

**Why it happens:** Chrome's message passing requires explicit signaling for async responses. Handlers must either:
1. Return literal `true` to keep the message channel open for `sendResponse()`, or
2. Return a Promise (Chrome 144+)

**Consequences:**
- Content script command injection fails silently
- Race conditions between command receipt and execution
- Extension appears unresponsive to remote commands

**Prevention:**
```javascript
// WRONG - async function without return value
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  const result = await processCommand(message);
  sendResponse(result); // This will never reach the sender
});

// RIGHT - return true for async sendResponse
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  processCommand(message).then(result => {
    sendResponse(result);
  });
  return true; // Keep channel open
});

// ALSO RIGHT - return Promise (Chrome 144+)
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  const result = await processCommand(message);
  return result; // Promise resolves to response
});
```

**Detection:**
- `sendResponse` called but content script receives `undefined`
- "A listener indicated an asynchronous response by returning true, but the message channel closed" error
- Intermittent command failures

**Phase impact:** Phase 1 (Basic Command Execution) - Message passing is core communication pattern.

**Source confidence:** HIGH - [Chrome Message Passing Documentation](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)

---

### Pitfall 3: Keyboard Events are `isTrusted: false`
**What goes wrong:** Extension injects keyboard events using `dispatchEvent()`, but video player ignores them because `event.isTrusted` is `false`. Security-conscious sites (and many video players) only respond to genuine user interactions.

**Why it happens:** Browser security model marks all script-generated events as untrusted. Only actual user actions create trusted events (`isTrusted: true`).

**Consequences:**
- Simulated spacebar doesn't pause/play video
- Arrow keys don't seek in video player
- S/D keys for speed control are ignored
- Extension fundamentally cannot work on target site

**Prevention:**
```javascript
// DOES NOT WORK - isTrusted will be false
const event = new KeyboardEvent('keydown', { key: 's' });
document.dispatchEvent(event);

// WORKAROUND 1: Use chrome.debugger API (WARNING: shows debugger banner)
chrome.debugger.attach({ tabId }, "1.3", () => {
  chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "s"
  });
});

// WORKAROUND 2: Direct DOM manipulation (if video player API exposed)
const video = document.querySelector('video');
video.playbackRate = 1.5; // Instead of simulating 'S' key
```

**Critical constraint:** `chrome.debugger` displays a banner "DevTools debugger is attached" which is terrible UX. This may be a fundamental blocker for the keyboard simulation approach.

**Alternative approach:** Instead of simulating keyboard events, directly manipulate the video element and player controls via DOM manipulation. Test early whether pCloud's video player exposes sufficient API surface.

**Detection:**
- Video player doesn't respond to extension-generated events
- Browser console shows events have `isTrusted: false`
- Manual keyboard shortcuts work but extension-triggered ones don't

**Phase impact:** Phase 0 (Feasibility Spike) - This could invalidate the entire keyboard simulation approach. Recommend POC testing on actual pcloud.link before proceeding with full roadmap.

**Source confidence:** HIGH - [Event.isTrusted Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Event/isTrusted), [Chrome Extension Issue Discussion](https://groups.google.com/a/chromium.org/g/chromium-dev/c/94t2J_Jylyw)

---

### Pitfall 4: Content Script Injection Timing Race
**What goes wrong:** Service worker receives Convex command and attempts to inject content script into video tab, but injection fails or executes before video element exists. Command is lost or executes against incomplete DOM.

**Why it happens:** Multiple timing hazards:
1. Tab may still be loading when injection is attempted
2. Video element may load asynchronously after `document_idle`
3. Single Page Application (SPA) navigation doesn't trigger new content script injection
4. `chrome.scripting.executeScript` has no guarantee of timing relative to page load

**Consequences:**
- `querySelector('video')` returns `null`
- Command executes but has no effect
- Intermittent failures depending on network speed
- Works in development (fast localhost) but fails in production

**Prevention:**
```javascript
// WRONG - assumes video exists immediately
chrome.scripting.executeScript({
  target: { tabId },
  func: () => {
    document.querySelector('video').pause(); // May be null
  }
});

// RIGHT - wait for video element with timeout
chrome.scripting.executeScript({
  target: { tabId },
  func: () => {
    const waitForVideo = (callback, timeout = 5000) => {
      const start = Date.now();
      const check = () => {
        const video = document.querySelector('video');
        if (video) {
          callback(video);
        } else if (Date.now() - start < timeout) {
          setTimeout(check, 100);
        } else {
          console.error('Video element not found');
        }
      };
      check();
    };

    waitForVideo((video) => {
      video.pause();
    });
  }
});
```

**Additional consideration:** pCloud may be an SPA. Use `chrome.webNavigation.onHistoryStateUpdated` to detect client-side navigation and re-inject content script if needed.

**Detection:**
- "Cannot read properties of null (reading 'pause')" errors
- Commands work on page refresh but not on first load
- Success rate varies by network conditions

**Phase impact:** Phase 1 (Basic Command Execution) - Core execution reliability depends on solving this.

**Source confidence:** MEDIUM - [Chrome Scripting API](https://developer.chrome.com/docs/extensions/reference/api/scripting), [SPA Extension Support](https://medium.com/@softvar/making-chrome-extension-smart-by-supporting-spa-websites-1f76593637e8)

---

### Pitfall 5: Convex WebSocket Reconnection Bug
**What goes wrong:** Convex WebSocket connection drops silently and never reconnects, leaving extension unable to receive new commands. No error is surfaced to the user or developer.

**Why it happens:** Known race condition in Convex JS client (Issue #22): when token authentication expires during a query/mutation, the reauthentication returns early and never restarts the connection.

**Consequences:**
- Commands sent from web app never reach extension
- Extension appears to work (no errors) but doesn't respond
- Only detectable by sending test command and observing no response
- Requires extension reload to fix

**Prevention:**
```javascript
// Implement connection state monitoring
const convexClient = new ConvexReactClient(CONVEX_URL);

// Monitor connection state
convexClient.onConnectionChange((state) => {
  console.log('Convex connection:', state);
  if (state === 'disconnected') {
    // Attempt manual reconnection or show warning
    chrome.storage.local.set({ connectionLost: true });
  }
});

// Periodic health check
chrome.alarms.create('convex-health-check', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'convex-health-check') {
    // Send test query to verify connection
    // If fails, reinitialize client
  }
});
```

**Alternative:** Use Convex HTTP API with polling as fallback if WebSocket connection seems unstable in production.

**Detection:**
- Extension works after installation but stops receiving commands after ~1 hour
- No errors in console, just silent failure
- Commands resume after extension reload

**Phase impact:** Phase 2 (Convex Integration) - Critical for production reliability.

**Source confidence:** MEDIUM - [Convex WebSocket Reconnection Bug](https://github.com/get-convex/convex-js/issues/22), [General WebSocket Reconnection Guidance](https://oneuptime.com/blog/post/2026-01-24-websocket-reconnection-logic/view)

---

### Pitfall 6: Cross-Origin Cookie Issues with Clerk
**What goes wrong:** User is authenticated in web app (Next.js + Clerk) but extension shows as logged out, or vice versa. Session state is not synchronized between contexts.

**Why it happens:**
- Chrome extensions run in isolated context with separate cookie jar from regular web pages
- Clerk sessions rely on cookies that don't automatically share between web app and extension
- Service workers can't directly access cookies set by web app

**Consequences:**
- User must log in twice (once in app, once in extension)
- Session expires in extension while still valid in app
- Confusing UX where commands only work if extension is separately authenticated

**Prevention:**
```javascript
// Use Clerk's Sync Host feature
// In manifest.json, add host permissions for your web app
{
  "host_permissions": [
    "https://your-web-app.com/*"
  ],
  "permissions": ["cookies", "storage"]
}

// In service worker, use Clerk's Chrome extension SDK
import { createClerkClient } from '@clerk/chrome-extension';

const clerk = await createClerkClient({
  publishableKey: CLERK_PUBLISHABLE_KEY,
  syncHost: 'https://your-web-app.com' // Sync with web app
});

// createClerkClient handles token refresh in background
// Prevents stale sessions when popup/panel is closed
```

**Critical detail:** Without `createClerkClient()`, session tokens expire after 60 seconds when popup is closed because Clerk's refresh process isn't running. This causes authentication failures.

**Detection:**
- Extension auth state different from web app auth state
- "Session token expired" errors after popup closed for >60s
- Users report having to log in to extension separately

**Phase impact:** Phase 2 (Convex Integration + Auth) - Affects whether extension can make authenticated Convex requests.

**Source confidence:** HIGH - [Clerk Chrome Extension Sync Host](https://clerk.com/docs/guides/sessions/sync-host), [Clerk Chrome Extension SDK 2.0](https://clerk.com/changelog/2024-11-22-chrome-extension-sdk-2.0)

---

## Moderate Pitfalls

Mistakes that cause delays or technical debt.

### Pitfall 7: Cross-Origin Request CORS Errors
**What goes wrong:** Content script tries to make network request to Convex or external API and gets CORS error, despite extension having host permissions.

**Why it happens:** Starting in Chrome 73, content scripts are subject to the SAME CORS policy as the page they're injected into. Only service workers have elevated cross-origin privileges.

**Consequences:**
- Can't fetch user profile from content script
- Can't log analytics from content script context
- Forces awkward message passing for simple requests

**Prevention:**
```javascript
// WRONG - CORS error from content script
// content-script.js
fetch('https://api.convex.dev/...') // CORS error

// RIGHT - relay through service worker
// content-script.js
chrome.runtime.sendMessage({
  type: 'FETCH',
  url: 'https://api.convex.dev/...'
}, (response) => {
  console.log(response);
});

// service-worker.js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'FETCH') {
    fetch(msg.url)
      .then(r => r.json())
      .then(data => sendResponse(data));
    return true; // Keep channel open
  }
});
```

**Detection:**
- Console errors: "CORS policy: No 'Access-Control-Allow-Origin' header"
- Requests work from service worker but fail from content script
- Same request succeeds when made from extension popup

**Phase impact:** Phase 2 (Convex Integration) - Determines where Convex client can be initialized.

**Source confidence:** HIGH - [Chrome Cross-Origin Requests](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests), [Chromium Extension CORS Changes](https://www.chromium.org/Home/chromium-security/extension-content-script-fetches/)

---

### Pitfall 8: Multiple Tabs with Same Domain
**What goes wrong:** User has multiple pCloud tabs open. Command from web app is sent to wrong tab, or broadcast to all tabs causing multiple videos to pause simultaneously.

**Why it happens:**
- Service worker receives command with no inherent tab context
- Tab matching by URL pattern may match multiple tabs
- No built-in "active tab" detection for target domain

**Consequences:**
- User plays video in Tab A, sends command from phone, but Tab B's video pauses instead
- All pCloud tabs respond to single command
- Confusing UX where wrong video is controlled

**Prevention:**
```javascript
// Strategy 1: Let user select target tab in extension popup
// Store selected tabId in chrome.storage

// Strategy 2: Control only the active tab
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]?.url?.includes('pcloud.link')) {
    // Execute command on active tab
  }
});

// Strategy 3: Include tab ID in Convex command
// Web app UI shows list of active pCloud tabs (via extension reporting)
// User selects which tab to control
```

**Recommended approach:** Have extension report all active pCloud tabs to Convex database. Web app shows "Control Tab 1" / "Control Tab 2" buttons. Commands include explicit `targetTabId`.

**Detection:**
- User reports wrong video responds to command
- Multiple videos pause at once
- Confusion about which tab is being controlled

**Phase impact:** Phase 3 (Multi-Tab Support) - Not critical for MVP but important for production UX.

**Source confidence:** MEDIUM - [Chrome Message Passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging), [Multiple Tabs Issue](https://github.com/openclaw/openclaw/issues/1998)

---

### Pitfall 9: `chrome.debugger` API Production Warning
**What goes wrong:** Developer uses `chrome.debugger` API to dispatch trusted events (solves Pitfall 3), but this displays a prominent "Chrome is being controlled by automated test software" banner to users.

**Why it happens:** `chrome.debugger` is designed for development/testing, not production use. Chrome intentionally shows warning to prevent malicious extensions from silently debugging user sessions.

**Consequences:**
- Unprofessional UX with persistent warning banner
- Users think their browser is compromised
- Negative reviews mentioning "suspicious debugger message"
- ~2ms performance overhead per event vs ~0ms for regular events

**Prevention:**
- Avoid `chrome.debugger` in production
- Use direct video element API manipulation instead of keyboard simulation
- Test whether pCloud video player exposes programmatic controls

```javascript
// Instead of: chrome.debugger to send keypress
// Do: direct video control
const video = document.querySelector('video');

// Pause/Play instead of spacebar
if (command === 'PAUSE') {
  video.pause();
} else if (command === 'PLAY') {
  video.play();
}

// Seek instead of arrow keys
if (command === 'SEEK_FORWARD') {
  video.currentTime += 10;
}

// Speed control instead of S/D keys
if (command === 'SPEED_UP') {
  video.playbackRate = Math.min(video.playbackRate + 0.25, 2.0);
}
```

**Detection:**
- Users report seeing debugger warning
- Extension reviews mention "suspicious" or "automated test software"
- Performance profiling shows 2ms delays per command

**Phase impact:** Phase 0 (Feasibility Spike) - May require completely different technical approach.

**Source confidence:** HIGH - [Chrome Debugger API](https://developer.chrome.com/docs/extensions/reference/api/debugger), [Trusted Events Discussion](https://github.com/orstavik/ClickIsTrusted)

---

### Pitfall 10: Service Worker Keep-Alive Anti-Pattern
**What goes wrong:** Developer tries to keep service worker alive indefinitely using heartbeat patterns, timers, or persistent messaging. Chrome terminates service worker anyway or flags extension as abusive.

**Why it happens:** Developers want to avoid complexity of rehydrating WebSocket connections and subscription state. Attempting to work around Chrome's designed behavior.

**Consequences:**
- Extension still gets terminated (Chrome 110+ terminates on various conditions)
- Wastes device resources with unnecessary wake-ups
- Violates Chrome extension policies (only allowed for Enterprise/Education managed devices)
- Extension may be rejected or removed from Chrome Web Store

**Prevention:**
- Embrace ephemeral service workers
- Design subscription initialization to be fast and idempotent
- Use WebSocket connections (Chrome 116+ automatically extends lifetime for active WebSockets)
- Store state in `chrome.storage`, not memory

```javascript
// WRONG - heartbeat anti-pattern (policy violation)
chrome.alarms.create('keep-alive', { periodInMinutes: 0.1 });
chrome.alarms.onAlarm.addListener(() => {
  chrome.runtime.getPlatformInfo(); // Dummy API call
});

// RIGHT - let it sleep, wake on events
// Service worker wakes on:
// - chrome.runtime.onMessage (from content script or popup)
// - chrome.alarms (legitimate scheduled work)
// - Active WebSocket message received (Chrome 116+)

// Initialize Convex subscription when worker starts
let convexClient = null;

async function ensureConvexClient() {
  if (!convexClient) {
    convexClient = new ConvexClient(CONVEX_URL);
    // Subscription automatically reconnects when worker wakes
    convexClient.subscribe('commands', handleCommand);
  }
  return convexClient;
}

// Call ensureConvexClient() on every event handler
chrome.runtime.onMessage.addListener(async (msg) => {
  await ensureConvexClient();
  // Handle message
});
```

**Detection:**
- Code includes periodic alarms with no legitimate purpose
- Comments like "keep service worker alive" or "prevent termination"
- Extension rejected from Chrome Web Store with policy violation

**Phase impact:** Phase 2 (Convex Integration) - Architecture must be designed correctly from the start.

**Source confidence:** HIGH - [Chrome Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle), [Chrome 116+ WebSocket Improvements](https://developer.chrome.com/blog/longer-esw-lifetimes)

---

## Minor Pitfalls

Mistakes that cause annoyance but are fixable.

### Pitfall 11: Host Permissions User Prompt
**What goes wrong:** Extension requires `host_permissions` for `*://pcloud.link/*` but Chrome shows scary permission warning to users: "Read and change all your data on pcloud.link". Users decline installation.

**Why it happens:** Manifest V3 requires explicit user consent for host permissions. Broad permissions trigger prominent warnings.

**Consequences:**
- Lower installation rate
- Users concerned about privacy
- Negative reviews about "excessive permissions"

**Prevention:**
```json
// Use narrowest possible host permissions
{
  "host_permissions": [
    "*://pcloud.link/*/video/*" // Only video pages, not all of pCloud
  ]
}

// Or use activeTab permission + user gesture
{
  "permissions": ["activeTab"] // Temporary access, no scary warning
}
// Then require user to click extension icon when on video page
```

**Recommended approach:** Start with `activeTab` permission for MVP. Only request broader `host_permissions` if user opts into "always active" mode.

**Detection:**
- Low installation conversion rate
- Reviews mentioning privacy concerns
- User support requests about permission warnings

**Phase impact:** Phase 1 (Basic Command Execution) - Affects user trust and installation rate.

**Source confidence:** HIGH - [Chrome Declare Permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions), [Host Permissions in MV3](https://developer.chrome.com/docs/extensions/reference/manifest/host_permissions)

---

### Pitfall 12: Content Script World Context Confusion
**What goes wrong:** Content script can't access JavaScript variables or functions from the page (pCloud's video player API), or vice versa - page can't access extension's injected code.

**Why it happens:** Content scripts run in "isolated world" by default, separate from the main page's JavaScript context. This is a security feature but limits API access.

**Consequences:**
- Can't call pCloud's native player methods if they exist
- Video player event listeners don't fire for extension
- Must duplicate functionality that page already provides

**Prevention:**
```javascript
// Option 1: Inject script into MAIN world (Chrome 102+)
// manifest.json
{
  "content_scripts": [{
    "matches": ["*://pcloud.link/*"],
    "js": ["content.js"],
    "world": "MAIN" // Runs in page context, but no chrome.* APIs
  }]
}

// Option 2: Use window.postMessage bridge
// content-script.js (ISOLATED world)
window.postMessage({ type: 'GET_PLAYER_STATE' }, '*');

window.addEventListener('message', (event) => {
  if (event.data.type === 'PLAYER_STATE') {
    chrome.runtime.sendMessage({ state: event.data.state });
  }
});

// injected-script.js (MAIN world)
window.addEventListener('message', (event) => {
  if (event.data.type === 'GET_PLAYER_STATE') {
    const state = window.pCloudPlayer.getState(); // Can access page globals
    window.postMessage({ type: 'PLAYER_STATE', state }, '*');
  }
});
```

**Trade-off:** MAIN world can access page APIs but can't use `chrome.*` extension APIs. ISOLATED world is the reverse. Choose based on whether you need page API access or extension API access.

**Detection:**
- `window.pCloudPlayer is undefined` in content script
- Can see video element but can't access player methods
- TypeError accessing page's global objects

**Phase impact:** Phase 1 (Basic Command Execution) - May discover pCloud has native API that's easier than DOM manipulation.

**Source confidence:** MEDIUM - [Chrome Content Scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts), [Content Script World Context](https://github.com/crxjs/chrome-extension-tools/issues/695)

---

### Pitfall 13: Event Listener Registration Timing
**What goes wrong:** Service worker registers event listeners inside async functions or promises. Chrome doesn't detect them on initialization, so events are missed.

**Why it happens:** Chrome requires event listeners to be registered synchronously at the top level of the service worker script. Async registration creates race conditions.

**Consequences:**
- `chrome.runtime.onMessage` events missed intermittently
- `chrome.alarms.onAlarm` doesn't fire
- Unpredictable behavior where "sometimes it works"

**Prevention:**
```javascript
// WRONG - async listener registration
async function initializeExtension() {
  const settings = await chrome.storage.local.get('settings');
  chrome.runtime.onMessage.addListener((msg) => {
    // This listener may not be registered when events fire
  });
}
initializeExtension();

// RIGHT - listeners at top level, async work inside handler
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Listener registered immediately
  handleMessageAsync(msg).then(sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessageAsync(msg) {
  const settings = await chrome.storage.local.get('settings');
  // Async work here
}
```

**Detection:**
- Events work after manual service worker restart but not on initial load
- Intermittent "no listener" errors
- Events fire but no handler executes

**Phase impact:** Phase 1 (Basic Command Execution) - Common beginner mistake.

**Source confidence:** HIGH - [Chrome Service Worker Basics](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/basics), [Manifest V3 Migration](https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers)

---

### Pitfall 14: Storage Quota Exceeded
**What goes wrong:** Extension stores command history or video state in `chrome.storage.local` and eventually hits quota limits (10MB), causing storage writes to fail silently.

**Why it happens:** Developer doesn't implement data retention policy or log rotation. Logs/history accumulates over weeks of use.

**Consequences:**
- New commands can't be stored
- Extension state becomes corrupted
- No error visible to user, just silent failure

**Prevention:**
```javascript
// Implement bounded storage
const MAX_COMMAND_HISTORY = 100;

async function saveCommand(command) {
  const { commandHistory = [] } = await chrome.storage.local.get('commandHistory');

  // Keep only last 100 commands
  const updated = [...commandHistory, command].slice(-MAX_COMMAND_HISTORY);

  await chrome.storage.local.set({ commandHistory: updated });
}

// Monitor storage usage
chrome.storage.local.getBytesInUse(null, (bytes) => {
  if (bytes > 8 * 1024 * 1024) { // 8MB warning threshold
    console.warn('Storage usage high:', bytes);
    // Cleanup old data
  }
});
```

**Detection:**
- Storage writes fail after extension used for several weeks
- `chrome.storage.local.set()` throws quota exceeded error
- Extension works fine in testing but fails in production

**Phase impact:** Phase 3+ (History/Analytics features) - Only matters if storing significant data.

**Source confidence:** MEDIUM - [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)

---

### Pitfall 15: Focus Loss Breaking Keyboard Events
**What goes wrong:** User clicks extension popup or switches tabs while video is playing. Video player loses focus, keyboard events no longer work even after returning to tab.

**Why it happens:** Video players often require element focus for keyboard shortcuts. Chrome DevTools, popups, or tab switches remove focus from page elements.

**Consequences:**
- Commands work initially but stop after user interacts with popup
- Requires manual click on video to restore functionality
- Confusing UX: "it was working, now it's not"

**Prevention:**
```javascript
// Ensure video or container has focus before dispatching events
function executeCommand(command) {
  const video = document.querySelector('video');
  const container = video.closest('.video-container') || video;

  // Restore focus if lost
  if (document.activeElement !== container && document.activeElement !== video) {
    video.focus();
    // Small delay to ensure focus takes effect
    setTimeout(() => dispatchCommand(command), 50);
  } else {
    dispatchCommand(command);
  }
}

// Alternative: Use direct API manipulation instead of keyboard events
// This avoids focus dependency entirely
function executeCommand(command) {
  const video = document.querySelector('video');
  if (command === 'PAUSE') {
    video.pause(); // No focus required
  }
}
```

**Recommended:** Prioritize direct video element manipulation over keyboard event simulation to avoid focus dependencies entirely.

**Detection:**
- Commands work on first execution but fail after popup interaction
- Manual click on video page "fixes" the issue
- `document.activeElement` shows unexpected element

**Phase impact:** Phase 1 (Basic Command Execution) - Affects reliability of keyboard approach.

**Source confidence:** MEDIUM - [Focus Management](https://developer.chrome.com/docs/extensions/how-to/ui/a11y), [Focus Loss Discussion](https://github.com/testing-library/user-event/issues/553)

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Phase 0: Feasibility Spike | Keyboard simulation fundamentally blocked by `isTrusted: false` (Pitfall 3) | Test on actual pcloud.link immediately. If keyboard events don't work, pivot to direct video API manipulation before investing in full roadmap. |
| Phase 1: Basic Command Execution | Service worker lifecycle (Pitfall 1), message passing async (Pitfall 2), injection timing (Pitfall 4) | All critical. Review Chrome MV3 service worker documentation thoroughly. Test service worker termination scenarios. |
| Phase 2: Convex Integration | WebSocket reconnection bug (Pitfall 5), CORS in content scripts (Pitfall 7), Clerk session sync (Pitfall 6) | Implement connection health monitoring. Test token expiration scenarios. Verify Clerk Sync Host setup. |
| Phase 3: Multi-Tab Support | Multiple tabs same domain (Pitfall 8) | Design tab selection UX early. Don't assume single-tab usage. |
| Phase 4: Production Hardening | Debugger API warning if used (Pitfall 9), keep-alive anti-pattern (Pitfall 10), host permissions UX (Pitfall 11) | Ensure no `chrome.debugger` in production. Verify no heartbeat patterns. Request minimal permissions. |

## Sources

**Chrome Official Documentation:**
- [Extension Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [Message Passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)
- [Content Scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [Chrome Scripting API](https://developer.chrome.com/docs/extensions/reference/api/scripting)
- [Declare Permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions)
- [Chrome Debugger API](https://developer.chrome.com/docs/extensions/reference/api/debugger)
- [Cross-Origin Requests](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)
- [Longer Service Worker Lifetimes](https://developer.chrome.com/blog/longer-esw-lifetimes)
- [Manifest V3 Migration](https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers)

**Clerk Documentation:**
- [Clerk Chrome Extension Quickstart](https://clerk.com/docs/chrome-extension/getting-started/quickstart)
- [Sync Auth Status Between Extension and Web App](https://clerk.com/docs/guides/sessions/sync-host)
- [Chrome Extension SDK 2.0](https://clerk.com/changelog/2024-11-22-chrome-extension-sdk-2.0)

**Convex Documentation:**
- [Convex Real-time Overview](https://docs.convex.dev/realtime)
- [Convex Chrome Extension Example](https://github.com/ianmacartney/ts-chrome-extension-search-history)

**MDN Documentation:**
- [Event.isTrusted](https://developer.mozilla.org/en-US/docs/Web/API/Event/isTrusted)
- [Content Scripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts)

**Community Resources:**
- [Chrome Extension Manifest V3 Service Worker Timeout Mitigation](https://medium.com/@bhuvan.gandhi/chrome-extension-v3-mitigate-service-worker-timeout-issue-in-the-easiest-way-fccc01877abd)
- [Making Chrome Extensions Smart for SPAs](https://medium.com/@softvar/making-chrome-extension-smart-by-supporting-spa-websites-1f76593637e8)
- [Chrome Extension Cross-Origin CORS Changes](https://www.chromium.org/Home/chromium-security/extension-content-script-fetches/)
- [Convex WebSocket Reconnection Bug](https://github.com/get-convex/convex-js/issues/22)
- [WebSocket Reconnection Logic Best Practices](https://oneuptime.com/blog/post/2026-01-24-websocket-reconnection-logic/view)
- [isTrusted Event Discussion](https://groups.google.com/a/chromium.org/g/chromium-dev/c/94t2J_Jylyw)
- [Simulating JS Events](https://words.byvernacchia.com/blog/2023/04/simulating-js-events/)

**GitHub Issues:**
- [Convex Connection Closes Without Recovery](https://github.com/get-convex/convex-js/issues/22)
- [Content Script World Context Issue](https://github.com/crxjs/chrome-extension-tools/issues/695)
- [Browser Extension Multiple Tabs Issue](https://github.com/openclaw/openclaw/issues/1998)
- [Focus Loss in User Event](https://github.com/testing-library/user-event/issues/553)
