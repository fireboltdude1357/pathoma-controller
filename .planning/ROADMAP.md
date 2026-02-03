# Roadmap: Pathoma Controller

## Overview

Build a remote video playback controller that lets one person control video playback on another person's computer. Research revealed that keyboard simulation may fail due to isTrusted:false events, so Phase 0 validates feasibility of direct HTMLMediaElement API manipulation on pcloud.link before building full stack. After validation, build backend foundation (Convex + Clerk), web controller app, Chrome extension foundation, video control implementation, and finally integration with acknowledgments and error handling.

## Phases

**Phase Numbering:**
- Integer phases (0, 1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 0: Feasibility Spike** - Validate HTMLMediaElement API works on pcloud.link before full investment
- [ ] **Phase 1: Backend Foundation** - Convex schema, Clerk authentication, real-time command infrastructure
- [ ] **Phase 2: Web Controller App** - Next.js app with command UI and connection status
- [ ] **Phase 3: Extension Foundation** - Chrome extension with Convex subscription and service worker lifecycle
- [ ] **Phase 4: Video Control** - Content script that executes commands on pcloud.link video player
- [ ] **Phase 5: Integration & Polish** - End-to-end acknowledgments, error handling, production readiness

## Phase Details

### Phase 0: Feasibility Spike
**Goal**: Validate that direct HTMLMediaElement API manipulation works on pcloud.link videos before committing to full architecture
**Depends on**: Nothing (first phase)
**Requirements**: SPIKE-01, SPIKE-02, SPIKE-03
**Success Criteria** (what must be TRUE):
  1. Content script can inject into pcloud.link and find video element
  2. Play, pause, seek (currentTime), and speed (playbackRate) APIs successfully control video
  3. Decision made on implementation approach (direct API vs keyboard simulation)
**Plans**: TBD

Plans:
- (Pending planning)

### Phase 1: Backend Foundation
**Goal**: Working Convex backend with Clerk authentication that can store and distribute commands in real-time
**Depends on**: Phase 0
**Requirements**: AUTH-01, AUTH-02, AUTH-03
**Success Criteria** (what must be TRUE):
  1. User can authenticate via Clerk and receive JWT
  2. Only authorized emails (in Convex users table) can create commands
  3. Commands are stored in Convex and queryable via real-time subscriptions
  4. Admin can authorize users by adding emails directly in Convex dashboard
**Plans**: TBD

Plans:
- (Pending planning)

### Phase 2: Web Controller App
**Goal**: Next.js web app where authorized user can send playback commands and see connection status
**Depends on**: Phase 1
**Requirements**: CONN-01
**Success Criteria** (what must be TRUE):
  1. User can log in via Clerk and see authenticated UI
  2. User can trigger play, pause, seek, and speed commands via buttons
  3. Web app shows connection status indicator (connected/disconnected to Convex)
  4. Commands are successfully written to Convex and visible in dashboard
**Plans**: TBD

Plans:
- (Pending planning)

### Phase 3: Extension Foundation
**Goal**: Chrome extension with service worker that receives commands via Convex real-time subscription
**Depends on**: Phase 2
**Requirements**: EXT-01, EXT-02, CONN-02
**Success Criteria** (what must be TRUE):
  1. Extension loads and targets pcloud.link tabs only
  2. Service worker maintains Convex subscription and receives commands in real-time
  3. Extension auto-reconnects when connection drops (survives service worker termination)
  4. Extension persists authentication state across service worker restarts
**Plans**: TBD

Plans:
- (Pending planning)

### Phase 4: Video Control
**Goal**: Content script executes commands on pcloud.link video player using HTMLMediaElement API
**Depends on**: Phase 3
**Requirements**: PLAY-01, PLAY-02, PLAY-03, PLAY-04, PLAY-05, PLAY-06, PLAY-07, PLAY-08, PLAY-09, PLAY-10, PLAY-11, PLAY-12, EXT-03
**Success Criteria** (what must be TRUE):
  1. User can pause and play video from web app
  2. User can seek backward by 1s, 5s, 10s, 30s from web app
  3. User can seek forward by 1s, 5s, 10s, 30s from web app
  4. User can decrease and increase playback speed by 0.1x from web app
  5. Commands execute within 500ms of button press
**Plans**: TBD

Plans:
- (Pending planning)

### Phase 5: Integration & Polish
**Goal**: End-to-end command acknowledgment, error handling, and production readiness
**Depends on**: Phase 4
**Requirements**: CONN-03, EXT-04
**Success Criteria** (what must be TRUE):
  1. Web app shows command acknowledgment after extension executes command
  2. Extension handles errors gracefully (video not found, network issues, etc.)
  3. System works reliably with multiple pcloud.link tabs open (targets correct tab)
  4. All 22 v1 requirements verified working end-to-end
**Plans**: TBD

Plans:
- (Pending planning)

## Progress

**Execution Order:**
Phases execute in numeric order: 0 → 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 0. Feasibility Spike | 0/0 | Not started | - |
| 1. Backend Foundation | 0/0 | Not started | - |
| 2. Web Controller App | 0/0 | Not started | - |
| 3. Extension Foundation | 0/0 | Not started | - |
| 4. Video Control | 0/0 | Not started | - |
| 5. Integration & Polish | 0/0 | Not started | - |

---
*Roadmap created: 2026-02-02*
*Last updated: 2026-02-02*
