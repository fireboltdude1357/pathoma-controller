# Requirements: Pathoma Controller

**Defined:** 2025-02-02
**Core Value:** She can control video playback without interrupting his work flow.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Feasibility

- [x] **SPIKE-01**: Validate HTMLMediaElement API works on pcloud.link video player
- [x] **SPIKE-02**: Confirm content script can inject and access video element
- [x] **SPIKE-03**: Test play, pause, seek, and playbackRate controls

### Authentication

- [x] **AUTH-01**: User can log in via Clerk
- [x] **AUTH-02**: Only authorized emails (in Convex users table) can access controls
- [x] **AUTH-03**: Admin can add authorized emails directly in Convex dashboard

### Playback Controls

- [ ] **PLAY-01**: User can pause the video
- [ ] **PLAY-02**: User can play the video
- [ ] **PLAY-03**: User can seek backward by 1 second
- [ ] **PLAY-04**: User can seek backward by 5 seconds
- [ ] **PLAY-05**: User can seek backward by 10 seconds
- [ ] **PLAY-06**: User can seek backward by 30 seconds
- [ ] **PLAY-07**: User can seek forward by 1 second
- [ ] **PLAY-08**: User can seek forward by 5 seconds
- [ ] **PLAY-09**: User can seek forward by 10 seconds
- [ ] **PLAY-10**: User can seek forward by 30 seconds
- [ ] **PLAY-11**: User can decrease playback speed by 0.1x
- [ ] **PLAY-12**: User can increase playback speed by 0.1x

### Connection

- [x] **CONN-01**: Web app shows connection status (connected/disconnected)
- [ ] **CONN-02**: Extension auto-reconnects when connection drops
- [ ] **CONN-03**: Web app shows command acknowledgment (command received by extension)

### Extension

- [ ] **EXT-01**: Extension targets pcloud.link tabs
- [ ] **EXT-02**: Extension subscribes to commands via Convex real-time
- [ ] **EXT-03**: Extension executes commands via HTMLMediaElement API (not keyboard simulation)
- [ ] **EXT-04**: Extension sends acknowledgment after command execution

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhanced Controls

- **PLAY-13**: User can enter custom seek amount (seconds)
- **PLAY-14**: User can see current playback speed in UI

### Video Management

- **VID-01**: User can request video change via web app
- **VID-02**: User can see list of available videos

### Status Sync

- **STAT-01**: Web app shows current video timestamp
- **STAT-02**: Web app shows video duration
- **STAT-03**: Web app shows play/pause state

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Video preview in web app | She watches via Discord screen share |
| Multiple simultaneous controllers | Single authorized user only |
| Mobile native app | Web app works on mobile browser |
| Keyboard simulation approach | Research: isTrusted:false may be ignored |
| Playlist management | Manual video selection for v1 |
| Multi-tab control | Single pcloud.link tab target |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SPIKE-01 | Phase 0 | Complete |
| SPIKE-02 | Phase 0 | Complete |
| SPIKE-03 | Phase 0 | Complete |
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| PLAY-01 | Phase 4 | Pending |
| PLAY-02 | Phase 4 | Pending |
| PLAY-03 | Phase 4 | Pending |
| PLAY-04 | Phase 4 | Pending |
| PLAY-05 | Phase 4 | Pending |
| PLAY-06 | Phase 4 | Pending |
| PLAY-07 | Phase 4 | Pending |
| PLAY-08 | Phase 4 | Pending |
| PLAY-09 | Phase 4 | Pending |
| PLAY-10 | Phase 4 | Pending |
| PLAY-11 | Phase 4 | Pending |
| PLAY-12 | Phase 4 | Pending |
| CONN-01 | Phase 2 | Complete |
| CONN-02 | Phase 3 | Pending |
| CONN-03 | Phase 5 | Pending |
| EXT-01 | Phase 3 | Pending |
| EXT-02 | Phase 3 | Pending |
| EXT-03 | Phase 4 | Pending |
| EXT-04 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0 ✓

---
*Requirements defined: 2025-02-02*
*Last updated: 2026-02-03 (Phase 2 requirements complete)*
