# Project Research Summary

**Project:** Pathoma Controller (Remote Video Playback Controller)
**Domain:** Chrome Extension + Real-time Backend (Web-to-Extension Command System)
**Researched:** 2026-02-02
**Confidence:** HIGH

## Executive Summary

This project is a remote video playback controller enabling command delivery from a Next.js web app to a Chrome extension, which then controls video playback on pcloud.link. Expert implementations favor **direct DOM manipulation via HTMLMediaElement API over keyboard event simulation**, as synthetic keyboard events have `isTrusted: false` and may be ignored by security-conscious video players. The recommended stack leverages Convex for automatic real-time synchronization (eliminating manual WebSocket management and the 30-second service worker inactivity problem), Clerk for authentication, and WXT framework (over CRXJS) for extension tooling due to better long-term viability and 40% smaller bundle sizes.

The critical architectural finding is to **use Convex as the single source of truth** between web app and extension, rather than direct chrome.runtime messaging. This provides clean separation, independent testability, and handles service worker termination gracefully. Commands flow: Web App → Convex mutation → Real-time subscription → Chrome Extension Service Worker → Content Script → Video element manipulation.

**Key risk:** Keyboard simulation may not work on pcloud.link if the player ignores `isTrusted: false` events. **Mitigation:** Phase 0 feasibility spike recommended to test direct video element API manipulation (`video.pause()`, `video.play()`, `video.currentTime`, `video.playbackRate`) on actual pcloud.link videos before full roadmap commitment. This approach is more reliable, doesn't require focus management, and bypasses keyboard event trust issues entirely.

## Key Findings

### Recommended Stack

The stack prioritizes security-patched versions, automatic real-time synchronization, and modern developer experience. **Critical security requirement:** Use Next.js 15.5.9+ (CVE-2025-66478 patch) and Clerk 6.36.8+ (CVE-2025-29927 patch, CVSS 9.1 critical). The Convex decision eliminates 20-second keepalive message requirements for WebSockets in Manifest V3 service workers, as Convex client handles connection management automatically across service worker restarts.

**Core technologies:**
- **WXT (not CRXJS)**: Extension framework — CRXJS requires new maintainers by March 2025 or archives June 2025; WXT has active community, produces 40% smaller bundles (400KB vs 700KB), and is framework-agnostic
- **Next.js 15.5.9+**: React framework with App Router — Required for CVE-2025-66478 security patch; App Router provides native React Server Components
- **Convex 1.31.5+**: Real-time database & backend — Automatic real-time subscriptions without manual WebSocket code; tracks dependencies and re-runs queries on DB changes; handles auth integration with Clerk
- **Clerk 6.36.8+**: Authentication — Must use 6.36.8+ for CVE-2025-29927 security patch (CVSS 9.1); first-class Next.js App Router support; Chrome extension SDK 2.0 with Sync Host prevents 60-second session token expiration
- **TypeScript 5.8.3+**: Type safety — Improved watch mode performance critical for HMR; Google's `chrome-types` package provides autocompletion for Chrome APIs

**Alternative considered and rejected:** Raw WebSockets require manual keepalive messages every 20 seconds to prevent service worker termination. Convex abstracts this complexity entirely.

### Expected Features

Research revealed that this project is **reverse of typical Chrome media controllers**: most extensions add keyboard shortcuts to sites that lack them (input mapping pattern), whereas this project sends commands from web app that extension executes (remote control pattern). Zero existing examples found of "web app → extension" remote control pattern in the wild.

**Must have (table stakes):**
- Basic playback controls (play/pause) — Core function, single command pattern
- Seek backward/forward — Standard media remote feature, 5s/10s/30s intervals typical
- Speed control — Common for educational content (0.1x increments, 0.5x-2x range)
- Real-time command delivery — Commands must arrive within 100-500ms via WebSocket/subscription
- Connection status indicator — Color-coded status (green/yellow/red) following Carbon Design System patterns
- Visual command feedback — Immediate response (0-50ms) with button press states
- Error recovery — Auto-reconnect with exponential backoff on disconnections

**Should have (competitive differentiators):**
- Command acknowledgment — Extension sends "executed" confirmation back to web app
- Custom seek intervals — User-configurable time jumps (1s/5s/10s/30s/custom)
- Connection latency indicator — Shows round-trip time or "slow connection" warning
- "Last command" indicator — Shows "Paused 2s ago" or "Seeking +10s" for feedback loop

**Defer (v2+):**
- Bidirectional status sync — Adds massive complexity, not needed for screen-share use case (trust command execution)
- Video preview/thumbnail — Requires video stream access, scope creep beyond remote control
- Playlist management — Single video tab focus only
- Command history/logging — Privacy concern, keep only "last command" for feedback
- Offline command queuing — False expectations, show disconnected state instead

**Anti-features (explicitly avoid):**
- Extension popup/options page — Zero UI in extension, all control from web app
- Custom video player UI — Conflicts with existing player, inject commands to existing player instead
- Per-site configuration — Works on pcloud.link only, no configuration needed
- Multi-user access control — Over-engineering for single-user scenario

### Architecture Approach

The recommended architecture uses **Convex as the interface boundary** between web app and extension. This provides clean separation of concerns: web app writes commands to Convex, extension reads from Convex. Both components are independently testable and deployable. The database acts as single source of truth, avoiding tight coupling via chrome.runtime.sendMessage.

**Pattern discovery: Direct DOM manipulation preferred over keyboard simulation.** The HTMLMediaElement API (`video.play()`, `video.pause()`, `video.currentTime`, `video.playbackRate`) is more reliable than keyboard event simulation because:
1. Simulated keyboard events have `isTrusted: false` which many players ignore for security
2. Direct API works regardless of keyboard shortcut configuration
3. No focus dependency (keyboard events require active element focus)
4. Standard interface for all HTML5 video players

**Major components:**
1. **Next.js Web App** — User authentication (Clerk), command UI, send commands to Convex via mutations
2. **Convex Backend** — Store commands table with `userId` index, distribute via real-time subscriptions, validate JWTs from Clerk
3. **Chrome Service Worker** — Maintain Convex subscription (ephemeral, wakes on events), lifecycle management, route commands to content script
4. **Chrome Content Script** — Inject into pcloud.link pages, execute commands on video element via HTMLMediaElement API, report status back to service worker

**Critical pattern: Event-driven service workers.** Manifest V3 service workers are ephemeral and terminate after 30 seconds of inactivity. ALL state must be stored in `chrome.storage.local` or `chrome.storage.session`, never in global variables. Event listeners must be registered at the top level (not inside async functions), or Chrome won't detect them on initialization. Convex subscriptions automatically reconnect when service worker restarts.

**Convex schema structure:** Users table with `clerkId` index, Commands table with `by_user_timestamp` compound index. Commands include `userId` (foreign key), `action` (literal union: play/pause/seek/speed), optional `seconds`/`rate` parameters, `timestamp`, and `executed` boolean. Database cleanup mutation runs daily to remove executed commands older than 24 hours.

### Critical Pitfalls

These mistakes would cause rewrites or major issues. Prevention is essential.

1. **Service Worker Lifecycle Misunderstanding** — Developers assume service workers stay alive indefinitely and store state in global variables. Service workers terminate after 30 seconds of inactivity, causing complete loss of subscription state. **Prevention:** Store ALL state in `chrome.storage`, not memory. Design subscription management to reinitialize on service worker restart. Test by manually terminating service worker in `chrome://serviceworker-internals`.

2. **Keyboard Events are `isTrusted: false`** — Extension injects keyboard events using `dispatchEvent()`, but video player ignores them because `event.isTrusted` is `false`. Security-conscious players only respond to genuine user interactions. **Prevention:** Use HTMLMediaElement API directly (`video.pause()`, `video.currentTime`, etc.) instead of keyboard simulation. If keyboard simulation is required, `chrome.debugger` API can dispatch trusted events but displays permanent "debugger attached" banner (terrible UX for production).

3. **Message Passing Async Response Failure** — Content script expects response from service worker but gets `undefined`. Chrome's message passing requires explicit signaling for async responses: handlers must return literal `true` to keep message channel open for `sendResponse()`, or return a Promise (Chrome 144+). **Prevention:** Always return `true` from async message handlers, or use Promise-based handlers.

4. **Content Script Injection Timing Race** — Service worker receives command and injects content script, but injection executes before video element exists. `querySelector('video')` returns `null`. **Prevention:** Wait for video element with timeout (5 seconds typical). For SPAs like pCloud, use `chrome.webNavigation.onHistoryStateUpdated` to detect client-side navigation and re-inject if needed.

5. **Clerk Session Sync Between Web App and Extension** — User authenticated in web app but extension shows logged out. Clerk sessions rely on cookies that don't automatically share between web app and extension contexts. **Prevention:** Use Clerk's Chrome extension SDK 2.0 with `createClerkClient({ syncHost })` to sync sessions. Without this, session tokens expire after 60 seconds when popup is closed because Clerk's refresh process isn't running.

6. **Convex WebSocket Reconnection Bug** — Known race condition in Convex JS client (Issue #22): when token authentication expires during a query/mutation, reauthentication returns early and never restarts connection. Commands stop arriving with no error. **Prevention:** Implement connection state monitoring via `convexClient.onConnectionChange()` and periodic health checks with test queries.

## Implications for Roadmap

Based on research, suggested phase structure prioritizes **validation before investment**. The keyboard simulation approach has fundamental uncertainty (isTrusted: false issue), requiring early testing on actual pcloud.link before committing to full roadmap.

### Phase 0: Feasibility Spike
**Rationale:** Pitfall research revealed keyboard events may be ignored if they have `isTrusted: false`. Testing on actual pcloud.link is critical before investing in full architecture.
**Delivers:** Proof-of-concept showing whether direct video element API manipulation works on pcloud.link, or if keyboard simulation is required
**Tests:** Create minimal content script that executes `video.pause()`, `video.play()`, `video.currentTime += 10`, `video.playbackRate = 1.5` on pcloud.link video
**Avoids:** Pitfall #2 (keyboard events ignored), Pitfall #9 (chrome.debugger banner in production)
**Duration:** 2-4 hours
**Decision point:** If direct API works → proceed to Phase 1. If API blocked → evaluate chrome.debugger trade-off or pivot approach.

### Phase 1: Core Backend (Convex + Clerk)
**Rationale:** Both web app and extension depend on backend. Can test with Convex dashboard before building UIs. Establishes authentication flow that both contexts will use.
**Delivers:** Working Convex schema, mutations (create command, mark executed), queries (watch user commands), Clerk authentication
**Addresses:** Table stakes foundation for real-time command delivery
**Uses:** Convex 1.31.5+, Clerk 6.36.8+ (security patches), Next.js 15.5.9+ App Router
**Implements:** Users table with `clerkId` index, Commands table with `by_user_timestamp` compound index
**Avoids:** Architecture anti-pattern of direct extension-to-webapp messaging (Convex is single source of truth)
**Can deploy independently:** Yes (test via Convex dashboard)
**Research flag:** LOW — Well-documented Clerk + Convex integration patterns

### Phase 2: Web Controller App
**Rationale:** Easier to develop and test than extension. Can verify backend works by watching Convex dashboard and seeing commands created in real-time.
**Delivers:** Next.js app with Clerk auth, Convex provider integration, command button UI (play/pause/seek/speed), visual feedback
**Addresses:** Connection status indicator, visual command feedback (table stakes)
**Uses:** ConvexProviderWithClerk, useAuth hook, useMutation for command creation
**Implements:** Command buttons with press states, connection status indicator (green/yellow/red)
**Avoids:** Building extension first (harder to debug without working backend to test against)
**Can deploy independently:** Yes (but pointless without extension)
**Research flag:** LOW — Standard Next.js + Clerk patterns

### Phase 3: Extension Foundation (Service Worker + Subscription)
**Rationale:** Requires working backend to test subscriptions. Focus on service worker lifecycle and Convex subscription before attempting video manipulation.
**Delivers:** WXT scaffold, Manifest V3 config, service worker with Convex client, real-time subscription to commands, chrome.storage session management
**Addresses:** Real-time command delivery (table stakes), error recovery (auto-reconnect)
**Uses:** WXT framework, ConvexClient from `convex/browser`, chrome.storage.local for auth tokens
**Implements:** Event-driven service worker pattern (listeners at top level), Convex subscription that reconnects on worker restart
**Avoids:** Pitfall #1 (service worker lifecycle), Pitfall #5 (WebSocket reconnection bug), Pitfall #10 (keep-alive anti-pattern)
**Testing:** Use Convex dashboard to inject test commands, verify extension receives them
**Can deploy independently:** No (needs Phase 1 backend)
**Research flag:** MEDIUM — WXT is newer than CRXJS, but well-documented; Convex reconnection monitoring needs custom implementation

### Phase 4: Video Control Implementation
**Rationale:** Requires extension foundation from Phase 3. This is where feasibility spike findings from Phase 0 are applied at scale.
**Delivers:** Content script injection on pcloud.link, video element detection with timeout, HTMLMediaElement API integration (play/pause/seek/speed), status reporting
**Addresses:** Basic playback controls, seek controls, speed control (all table stakes)
**Uses:** chrome.scripting.executeScript with `world: "MAIN"` if needed, `querySelector('video')` with 5-second timeout
**Implements:** Video command execution handlers using direct API calls (not keyboard simulation), waitForVideo pattern for timing race
**Avoids:** Pitfall #3 (keyboard events isTrusted: false), Pitfall #4 (injection timing race), Pitfall #15 (focus loss)
**Testing:** Test on actual pcloud.link videos with various states (loading, playing, paused)
**Can deploy independently:** No (needs Phase 3)
**Research flag:** MEDIUM — pCloud player may have quirks; SPA navigation detection may be needed

### Phase 5: Integration & Polish
**Rationale:** Requires all components working. Addresses production readiness and UX improvements.
**Delivers:** End-to-end testing, error handling with retry logic, command acknowledgment (extension → Convex), multi-tab handling UI, connection latency indicator
**Addresses:** Command acknowledgment, connection latency indicator, custom seek intervals (should-have features)
**Uses:** Command acknowledgment via Convex mutation from extension, tab ID tracking in commands table
**Implements:** Multi-tab selection UI in web app (shows active pcloud.link tabs), retry queue with exponential backoff, health check alarms
**Avoids:** Pitfall #8 (multiple tabs same domain confusion), Pitfall #6 (Clerk session sync issues)
**Testing:** Load multiple pcloud.link tabs, verify correct tab receives commands; test disconnection scenarios
**Research flag:** LOW — Standard error handling patterns

### Phase Ordering Rationale

- **Phase 0 first** because keyboard simulation uncertainty (Pitfall #2, #9) could invalidate entire approach. Must validate before investing in full stack.
- **Backend before frontend** (Phase 1 before Phase 2) allows testing with Convex dashboard, provides solid foundation for both web app and extension.
- **Web app before extension** (Phase 2 before Phase 3) because web app is easier to develop and debug. Can verify commands are created in Convex before dealing with extension complexities.
- **Extension foundation before video control** (Phase 3 before Phase 4) separates concerns: get service worker lifecycle and Convex subscription working before attempting DOM manipulation.
- **Integration last** (Phase 5) because it requires all components functional. Error handling and edge cases addressed after happy path works.

This ordering avoids **rework from pitfalls** by:
1. Validating assumptions early (Phase 0 feasibility spike)
2. Building on verified foundation (backend → web app → extension)
3. Separating concerns (service worker lifecycle separate from video manipulation)
4. Testing components independently before integration

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 0:** If direct video API fails on pcloud.link, may need to reverse-engineer player internals or accept chrome.debugger trade-off
- **Phase 4:** pCloud may be SPA requiring client-side navigation detection; video player may have non-standard behavior

**Phases with standard patterns (skip research-phase):**
- **Phase 1:** Clerk + Convex integration well-documented in official docs
- **Phase 2:** Standard Next.js App Router with Convex provider patterns
- **Phase 3:** Chrome service worker patterns documented by Google; WXT has official examples
- **Phase 5:** Standard error handling and retry logic patterns

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | All versions verified via official docs and npm registry (Feb 2026). Security patches confirmed. WXT vs CRXJS comparison from multiple 2025 framework reviews. |
| Features | **MEDIUM** | WebSearch verified with multiple GitHub implementations. No existing examples of exact "web app → extension" remote control pattern found. MVP feature set derived from similar media controller extensions. |
| Architecture | **HIGH** | Official Chrome extension docs, Convex real-time patterns, Clerk integration documented. HTMLMediaElement API is W3C standard with MDN documentation. Service worker lifecycle patterns from Google's migration guides. |
| Pitfalls | **HIGH** | All critical pitfalls verified with official Chrome/Clerk/Convex documentation. Keyboard event isTrusted issue confirmed across multiple sources including MDN and Chromium dev discussions. |

**Overall confidence:** **HIGH**

Research is based on official documentation for all core technologies. The one area of uncertainty is whether pcloud.link's specific video player will work with direct HTMLMediaElement API manipulation, which is why Phase 0 feasibility spike is recommended.

### Gaps to Address

**During Phase 0 (Feasibility Spike):**
- **pCloud video player specifics:** Test whether `video.pause()`, `video.play()`, `video.currentTime`, `video.playbackRate` work on actual pcloud.link videos. Player may have custom controls that override standard behavior.
- **SPA detection:** Verify if pCloud is a Single Page Application. If yes, implement `chrome.webNavigation.onHistoryStateUpdated` listener for client-side navigation.

**During Phase 3 (Extension Foundation):**
- **Convex reconnection monitoring:** Implement custom health check pattern for Pitfall #5 (WebSocket reconnection bug). Pattern inferred from issue discussion, needs validation in production.
- **Clerk Sync Host configuration:** Verify `createClerkClient({ syncHost })` prevents 60-second token expiration. Test by closing popup for 2+ minutes and checking if commands still execute.

**During Phase 4 (Video Control):**
- **Content script world context:** Determine if content script needs to run in MAIN world or ISOLATED world. If pCloud exposes custom player API, may need window.postMessage bridge or MAIN world injection.
- **Focus management:** Test if video element loses focus during popup interaction. If yes, implement focus restoration before command execution.

**During Phase 5 (Integration):**
- **Multi-tab selection UX:** Design how web app discovers and displays active pcloud.link tabs. Extension must report tabs to Convex; web app must show selection UI.

## Sources

### Primary (HIGH confidence)
- [Chrome Extension Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) — Service worker termination, event listener registration
- [Chrome Message Passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging) — Async response handling, return true pattern
- [Chrome Extensions: Manifest V3 Migration](https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers) — Persistent background vs ephemeral workers
- [Convex Real-time Documentation](https://docs.convex.dev/realtime) — Automatic subscriptions, dependency tracking
- [Convex Schemas](https://docs.convex.dev/database/schemas) — Index creation, compound indexes
- [Clerk Next.js Quickstart](https://clerk.com/docs/nextjs/getting-started/quickstart) — App Router integration
- [Clerk Chrome Extension SDK 2.0](https://clerk.com/changelog/2024-11-22-chrome-extension-sdk-2.0) — createClerkClient, Sync Host
- [MDN: Video and Audio APIs](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Client-side_web_APIs/Video_and_audio_APIs) — HTMLMediaElement standard interface
- [MDN: Event.isTrusted](https://developer.mozilla.org/en-US/docs/Web/API/Event/isTrusted) — Trusted vs synthetic events
- [Next.js 15.5 Release](https://nextjs.org/blog/next-15-5) — CVE-2025-66478 security patch
- [@clerk/nextjs npm](https://www.npmjs.com/package/@clerk/nextjs) — v6.36.8 CVE-2025-29927 patch
- [convex npm](https://www.npmjs.com/package/convex) — v1.31.5 latest stable

### Secondary (MEDIUM confidence)
- [WXT vs CRXJS Framework Comparison 2025](https://redreamality.com/blog/the-2025-state-of-browser-extension-frameworks-a-comparative-analysis-of-plasmo-wxt-and-crxjs/) — Bundle size comparison, maintenance status
- [Chrome Extension Architecture Guide 2026](https://jinlow.medium.com/chrome-extension-development-the-complete-system-architecture-guide-for-2026-9ae81415f93e) — Component communication patterns
- [Convex Chrome Extension Example](https://github.com/ianmacartney/ts-chrome-extension-search-history) — Real-time subscription implementation
- [Convex Relationship Structures](https://stack.convex.dev/relationship-structures-let-s-talk-about-schemas) — Schema design patterns
- [HTML5 Video API Guide](https://imagekit.io/blog/html5-video-api/) — Playback control methods
- [Carbon Design System: Status Indicators](https://v10.carbondesignsystem.com/patterns/status-indicator-pattern/) — Color-coded status UX patterns
- [chrome-media-controller by JosephusPaye](https://github.com/JosephusPaye/chrome-media-controller) — Media Session API, minimal permissions
- [chrome-media-controller by jsh9](https://github.com/jsh9/chrome-media-controller) — Standard keyboard shortcuts k/j/l/m

### Tertiary (LOW confidence, needs validation)
- [Convex WebSocket Reconnection Bug](https://github.com/get-convex/convex-js/issues/22) — Reauthentication race condition
- [WebSocket Reconnection Logic Best Practices](https://oneuptime.com/blog/post/2026-01-24-websocket-reconnection-logic/view) — Health check patterns
- [isTrusted Event Discussion](https://groups.google.com/a/chromium.org/g/chromium-dev/c/94t2J_Jylyw) — Trusted event bypass limitations
- [Making Chrome Extensions Smart for SPAs](https://medium.com/@softvar/making-chrome-extension-smart-by-supporting-spa-websites-1f76593637e8) — Client-side navigation detection

---
*Research completed: 2026-02-02*
*Ready for roadmap: yes*
