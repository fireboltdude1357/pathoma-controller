---
phase: 03-extension-foundation
plan: 02
subsystem: extension
tags: [chrome-extension, convex, websocket, service-worker, esbuild, real-time]

# Dependency graph
requires:
  - phase: 03-01
    provides: Extension skeleton with service worker entry point
  - phase: 01-backend-foundation
    provides: Convex commands table and getLatestUnacknowledged query
provides:
  - Real-time command subscription in extension service worker
  - Auto-reconnection via chrome.alarms keep-alive
  - State persistence across service worker restarts
  - esbuild bundler for extension with Convex client
affects: [04-content-script, 05-e2e-flows]

# Tech tracking
tech-stack:
  added:
    - esbuild (for extension bundling)
    - Convex browser client in service worker
    - chrome.storage.local for state persistence
    - chrome.alarms API for keep-alive
  patterns:
    - Singleton Convex client wrapper pattern
    - lastCommandId tracking for deduplication
    - Keep-alive pattern for service worker WebSocket persistence
    - Manual .env.local loading in build scripts

key-files:
  created:
    - extension/build.mjs
    - extension/convex-client.ts
  modified:
    - extension/background.ts
    - extension/manifest.json
    - package.json

key-decisions:
  - "esbuild over webpack for simpler extension bundling"
  - "Manual .env.local loading in build script (no dotenv dependency)"
  - "chrome.alarms at 30s interval for WebSocket keep-alive"
  - "lastCommandId tracking to prevent duplicate command processing"
  - "chrome.storage.local for state persistence across restarts"

patterns-established:
  - "Convex client wrapper pattern: singleton getConvexClient() with subscription helper"
  - "Service worker keep-alive: chrome.alarms periodically wakes service worker to maintain connection"
  - "Deduplication pattern: Track lastCommandId in chrome.storage to skip already-processed commands"

# Metrics
duration: ~6h (automated work 2min, checkpoint verification 6h)
completed: 2026-02-03
---

# Phase 03 Plan 02: Convex Subscription with Reconnection Summary

**Real-time command subscription in service worker with auto-reconnection, state persistence, and keep-alive WebSocket maintenance**

## Performance

- **Duration:** ~6 hours total (~2 min automated execution, checkpoint verification)
- **Started:** 2026-02-03T00:52:25-06:00
- **Completed:** 2026-02-03T06:40:13-06:00
- **Tasks:** 5 (4 auto + 1 checkpoint)
- **Files modified:** 7
- **Commits:** 5 (4 task commits + 1 fix during checkpoint)

## Accomplishments

- Service worker subscribes to Convex commands via real-time WebSocket
- Auto-reconnection using chrome.alarms keep-alive pattern (30s intervals)
- State persistence via chrome.storage.local survives service worker restarts
- esbuild bundler setup with CONVEX_URL injection for extension
- Duplicate command prevention via lastCommandId tracking

## Task Commits

Each task was committed atomically:

1. **Task 1: Set up esbuild for extension bundling** - `7ca3c65` (chore)
2. **Task 2: Create Convex client wrapper for service worker** - `e3a4d59` (feat)
3. **Task 3: Implement service worker with subscription and reconnection** - `fd1adc9` (feat)
4. **Task 4: Update manifest and build extension** - `f45f1d8` (chore)
5. **Task 5: Human verification checkpoint** - approved

**Fix during checkpoint:** `7f9e2f9` (fix: load .env.local in extension build script)

**Plan metadata:** (pending in this commit)

## Files Created/Modified

**Created:**
- `extension/build.mjs` - esbuild bundler with CONVEX_URL injection
- `extension/convex-client.ts` - Convex client wrapper with subscription helper

**Modified:**
- `extension/background.ts` - Service worker with subscription, persistence, keep-alive
- `extension/manifest.json` - Added alarms permission
- `package.json` - Added esbuild dependency, updated build:extension script
- `package-lock.json` - esbuild and dependencies
- `extension/dist/background.js` - Bundled output with Convex client (4967 lines)

## Decisions Made

**esbuild for extension bundling**
- Replaced tsc with esbuild to bundle Convex client into service worker
- Simpler than webpack, fast builds, built-in tree-shaking
- Alternative: webpack (more complex config)

**Manual .env.local loading in build script**
- Build script reads and parses .env.local directly (no dotenv dependency)
- Avoids adding runtime dependency to extension
- Alternative: dotenv package (adds dependency)

**chrome.alarms at 30s interval for keep-alive**
- Periodically wakes service worker to maintain WebSocket connection
- Chrome terminates idle service workers after 30s; alarms prevent termination
- Alternative: longer intervals (risks connection drops)

**lastCommandId tracking for deduplication**
- Stores last processed command ID in chrome.storage.local
- Prevents duplicate command execution after service worker restart
- Alternative: acknowledged flag in Convex (requires mutation, higher latency)

**chrome.storage.local for state persistence**
- Survives service worker termination and extension reload
- Provides async API compatible with service worker context
- Alternative: chrome.storage.session (doesn't survive restarts)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Load .env.local in extension build script**
- **Found during:** Task 5 (checkpoint verification)
- **Issue:** esbuild couldn't access NEXT_PUBLIC_CONVEX_URL environment variable during build because .env.local wasn't loaded
- **Fix:** Added manual .env.local file parsing to extension/build.mjs using fs.readFileSync
- **Files modified:** extension/build.mjs, extension/dist/background.js
- **Verification:** Build succeeds with CONVEX_URL properly injected
- **Committed in:** 7f9e2f9 (separate fix commit)

---

**Total deviations:** 1 auto-fixed (blocking issue)
**Impact on plan:** Essential fix for build to work. No scope creep - enables planned functionality.

## Issues Encountered

**Issue 1: CONVEX_URL not injected during build**
- **Problem:** Initial build.mjs assumed process.env.NEXT_PUBLIC_CONVEX_URL would be set, but .env.local not loaded by Node.js
- **Resolution:** Added manual .env.local parsing in build script
- **Learning:** Node.js doesn't auto-load .env files; must explicitly read or use dotenv

## Verification Results

All verification checks passed:

1. Extension loads without errors in Chrome
2. Service worker starts and connects to Convex successfully
3. Commands sent from web app (http://localhost:3000) appear in service worker console logs
4. Extension survives reload and auto-reconnects via alarms keep-alive
5. lastCommandId persists in chrome.storage.local (verified via devtools console)

**User confirmed:** "approved - the extension successfully receives commands in real-time"

## Technical Implementation Details

### esbuild Configuration (extension/build.mjs)

```javascript
await esbuild.build({
  entryPoints: ['extension/background.ts'],
  bundle: true,
  outfile: 'extension/dist/background.js',
  format: 'esm',
  target: 'es2020',
  platform: 'browser',
  define: {
    'process.env.CONVEX_URL': JSON.stringify(convexUrl)
  }
});
```

- Bundles Convex client and dependencies into single file
- Injects CONVEX_URL at build time (replaces process.env references)
- ESM format for Manifest V3 module support

### Convex Client Wrapper (extension/convex-client.ts)

```typescript
export function getConvexClient(): ConvexClient {
  if (!client) {
    client = new ConvexClient(CONVEX_URL);
  }
  return client;
}

export function subscribeToCommands(
  onCommand: (command: any) => void
): () => void {
  const convex = getConvexClient();
  return convex.onUpdate(
    api.commands.getLatestUnacknowledged,
    {},
    (command) => { if (command) onCommand(command); }
  );
}
```

- Singleton pattern ensures one Convex client instance
- subscribeToCommands() wraps Convex onUpdate API
- Returns unsubscribe function for cleanup

### Service Worker Subscription (extension/background.ts)

Key features:
1. **State persistence:** chrome.storage.local tracks lastCommandId
2. **Deduplication:** Skips commands already processed
3. **Keep-alive:** chrome.alarms fires every 30s to wake service worker
4. **Auto-reconnection:** Alarm handler restarts subscription if terminated
5. **Lifecycle hooks:** Subscription starts on activate and alarm events

```typescript
chrome.alarms.create('keepalive', { periodInMinutes: 0.5 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepalive' && !unsubscribe) {
    startSubscription().catch(console.error);
  }
});
```

### Manifest Permissions

```json
"permissions": ["storage", "alarms"]
```

- `storage`: Required for chrome.storage.local state persistence
- `alarms`: Required for keep-alive pattern

## Requirements Addressed

- **EXT-01:** Extension targets pcloud.link (via host_permissions in manifest)
- **EXT-02:** Service worker subscribes to commands via Convex real-time (getLatestUnacknowledged query)
- **CONN-02:** Extension auto-reconnects via chrome.alarms keep-alive (30s interval)
- Auth state (lastCommandId) persists via chrome.storage.local across restarts

## Integration Points

**Consumes from Phase 01 (Backend Foundation):**
- convex/commands.ts: getLatestUnacknowledged query
- NEXT_PUBLIC_CONVEX_URL environment variable

**Consumes from Plan 03-01 (Extension Skeleton):**
- extension/manifest.json structure
- extension/background.ts entry point
- TypeScript compilation setup

**Provides to Phase 04 (Content Script):**
- Working service worker with command subscription
- Pattern for chrome.storage state management
- Deduplication mechanism via lastCommandId

**Provides to Phase 05 (E2E Flows):**
- Real-time command delivery from web app to extension
- Reconnection resilience for long-running sessions

## Next Phase Readiness

**Ready for Phase 04:** Yes

**What's ready:**
- Service worker receives commands in real-time from Convex
- State persistence working across restarts
- Keep-alive maintains WebSocket connection
- Command deduplication prevents double-execution

**Next step (Phase 04):**
- Create content script to execute video commands
- Forward commands from service worker to content script
- Implement HTMLMediaElement API calls (play, pause, seek, speed)

**Blockers:** None

**Concerns:** None

## Performance Notes

- **Automated execution:** ~2 minutes (Tasks 1-4)
- **Checkpoint verification:** ~6 hours (manual testing with user)
- **Build time:** <1s (esbuild fast bundling)
- **Bundle size:** ~150KB (Convex client + dependencies)
- **Keep-alive overhead:** Minimal (30s alarm, no-op if subscription active)

## Learning & Context

**Chrome Extension Service Workers:**
- Service workers terminate after 30s of inactivity
- chrome.alarms API wakes service worker periodically
- WebSocket connections don't prevent termination (must use alarms)
- chrome.storage.local survives termination (chrome.storage.session doesn't)

**Convex Real-Time Subscriptions:**
- ConvexClient.onUpdate() creates live query subscription
- Subscription automatically reconnects when client is used
- Query runs on subscription setup and on any data change
- Returns unsubscribe function for cleanup

**esbuild for Extensions:**
- Bundle Convex client into single file (service workers can't use node_modules)
- `define` replaces process.env references at build time
- `platform: 'browser'` ensures browser-compatible output
- ESM format required for Manifest V3 `type: "module"`

**State Management Pattern:**
- Use chrome.storage.local for persistence (not in-memory variables)
- Service worker global state doesn't survive termination
- Always assume service worker can restart at any time

## Authentication Gates

None - Convex authentication will be handled in Phase 04 content script setup.

## User Setup Required

None - no additional external service configuration required. CONVEX_URL already configured in .env.local from Phase 01.

---
*Phase: 03-extension-foundation*
*Completed: 2026-02-03*
