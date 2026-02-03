# Feature Landscape

**Domain:** Remote video playback controller (web app + Chrome extension)
**Researched:** 2026-02-02
**Confidence:** MEDIUM (WebSearch verified with multiple GitHub implementations)

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Basic playback controls (play/pause) | Core function of any video controller | Low | Single command pattern |
| Seek backward/forward | Standard on all media remotes since 1980s | Low | Time intervals: 5s, 10s, 30s typical |
| Connection status indicator | Users need to know if remote is connected | Low | Color-coded status (green/yellow/red) |
| Visual command feedback | Users need confirmation command was sent | Low | Button press states, brief toast/flash |
| Speed control (faster/slower) | Common for educational content consumption | Medium | Typically 0.1x increments, range 0.5x-2x |
| Keyboard shortcut injection | Extension must simulate keys on video player | Medium | Uses KeyboardEvent dispatching to video element |
| Real-time command delivery | Commands must arrive within 100-500ms | Medium | WebSocket/real-time subscription required |
| Error recovery | Handle disconnections gracefully | Medium | Auto-reconnect, show retry status |

## Differentiators

Features that set product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Command acknowledgment | User sees confirmation command executed | Low-Medium | Extension sends "executed" message back |
| Custom seek intervals | Personalized time jumps beyond defaults | Low | User configures 1s/5s/10s/30s/custom |
| Command queue with retry | Reliable delivery even during brief disconnects | Medium | Exponential backoff, max 3 retries |
| Haptic/visual pulse on command | Satisfying tactile feedback loop | Low | Mobile vibration + button animation |
| Connection latency indicator | Shows round-trip time for commands | Low | "23ms" or "slow connection" warning |
| Multiple speed presets | Quick access to 1.25x, 1.5x, 1.75x, 2x | Low | Buttons for common speeds vs incremental |
| "Last command" indicator | Shows what was last executed | Low | "Paused 2s ago" or "Seeking +10s" |
| Zero-config pairing | No manual setup, works immediately | High | Requires authentication + auto-discovery |

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Bidirectional status sync | Adds massive complexity, not needed for screen-share use case | Trust command execution, show acknowledgment only |
| Video preview/thumbnail | Requires video stream access, permission creep | User watches via Discord screen share |
| Playlist management | Scope creep beyond single video control | Single video tab focus only |
| Multi-user access control | Over-engineering for single-user scenario | Hard-code authorization for girlfriend only |
| Custom video player UI | Conflicts with existing player controls | Inject keyboard events to existing player |
| Per-site configuration | Complexity users don't need | Works on pcloud.link only, no configuration |
| Extension popup/options page | Unnecessary UI for background-only extension | Zero UI in extension, all control from web app |
| Command history/logging | Privacy concern, adds complexity | Keep only "last command" for feedback |
| Offline command queuing | False expectations about execution | Show disconnected state, block commands |

## Feature Dependencies

```
Connection Establishment
  ├─> Real-time subscription (Convex)
  └─> Connection status indicator

Command Delivery
  ├─> Keyboard shortcut injection (content script)
  ├─> Visual command feedback (web app UI)
  └─> Command acknowledgment (optional enhancement)

Error Handling
  ├─> Connection status indicator
  ├─> Auto-reconnect logic
  └─> Command retry queue (optional enhancement)

Playback Controls
  ├─> Play/Pause (must have)
  ├─> Seek forward/backward (must have)
  └─> Speed control (must have)
```

## MVP Recommendation

For MVP, prioritize:

1. **Connection + Status** - Real-time subscription with connection indicator (Green = connected, Red = disconnected)
2. **Basic Playback** - Play, Pause via keyboard simulation
3. **Seek Controls** - Forward/backward with 1s, 5s, 10s, 30s intervals
4. **Speed Controls** - Speed up (D key), slow down (S key)
5. **Visual Feedback** - Button press states in web app
6. **Error Recovery** - Auto-reconnect on disconnect

Defer to post-MVP:
- **Command acknowledgment**: Adds round-trip complexity, basic visual feedback sufficient for MVP
- **Command queue with retry**: Network should be reliable enough for v1, add if needed
- **Custom seek intervals**: Start with fixed intervals, add customization based on usage
- **Latency indicator**: Nice-to-have for debugging, not essential for core functionality
- **Multiple speed presets**: Incremental speed control sufficient initially
- **Haptic feedback**: Polish feature for mobile experience

## Architecture Implications

**Command Flow:**
```
Web App UI → Convex mutation → Real-time subscription → Chrome Extension → KeyboardEvent dispatch → Video player
```

**Status Flow (MVP - one-way only):**
```
Chrome Extension → Connection heartbeat → Convex → Web App UI (shows connected/disconnected)
```

**Status Flow (Post-MVP - with acknowledgment):**
```
Web App → Command sent → Extension executes → Extension → Ack message → Web App (shows "Paused ✓")
```

## User Experience Patterns

### Connection Status
- **Pattern**: Color-coded indicator (Carbon Design System)
  - Green dot = Connected and ready
  - Yellow dot = Connecting...
  - Red dot = Disconnected
- **Placement**: Top-right corner of remote control UI
- **Behavior**: Automatic reconnection attempts with exponential backoff

### Command Feedback
- **Pattern**: Immediate visual response (0-50ms)
  - Button press animation (scale down + darken)
  - Brief text flash: "Paused" or "Seeking +10s"
  - Success color pulse (green) if acknowledgment enabled
- **Timing**: Visual feedback before network round-trip (optimistic UI)
- **Error state**: Red pulse + "Command failed, retrying..." if no ack after 2s

### Keyboard Shortcuts (Extension Side)
- **Pattern**: Simulate exact keystrokes video player expects
- **Implementation**: `dispatchEvent(new KeyboardEvent('keydown', {key: ' '}))` for pause
- **Scope**: Inject into active video tab only
- **Conflict avoidance**: Check for video element before dispatching

### Error Handling
- **Pattern**: Graceful degradation with user awareness
  - Connection lost: Show red status, disable controls
  - Command timeout: Show "Slow connection" warning
  - Extension not installed: Show install prompt in web app
- **Retry strategy**: Exponential backoff (1s, 2s, 4s) max 3 attempts

## Complexity Assessment

| Feature Category | Complexity | Estimated Effort |
|------------------|------------|------------------|
| Web app UI (buttons + status) | Low | 2-4 hours |
| Convex real-time mutations | Low | 1-2 hours |
| Chrome extension scaffolding | Low | 1-2 hours |
| Keyboard event injection | Medium | 2-4 hours |
| Connection status + auto-reconnect | Medium | 3-5 hours |
| Command acknowledgment | Medium | 4-6 hours |
| Command queue with retry | High | 6-8 hours |

**MVP Total**: ~12-20 hours (without acknowledgment/retry queue)
**Full Feature Set**: ~20-30 hours (with all differentiators)

## Lessons from Existing Implementations

### From GitHub chrome-media-controller (JosephusPaye)
- **Minimal permissions by default**: Only enable domains user explicitly allows
- **Granular control**: Context menu to enable/disable per domain
- **Non-invasive**: Use Media Session API, don't modify page DOM
- **Two-way communication**: Named pipes for CLI ↔ native host
- **Commands**: play, pause, stop, next, prev, seekb, seekf, seek, skipad

### From GitHub chrome-media-controller (jsh9)
- **Standard shortcuts**: k=play/pause, j=seek-10s, l=seek+10s, m=mute, w=vol+, s=vol-, </> =speed
- **Site compatibility matrix**: Test thoroughly, some sites block certain shortcuts
- **Partial support acceptable**: Netflix blocks j/l to prevent crashes, document limitations
- **No error handling mentioned**: Simple input mapping, no retry logic

### Common Pitfalls (from 5 Common Mistakes Building Chrome Extensions)
- **Permission creep**: Request only what you need, avoid "tabs" permission if possible
- **Security**: Use chrome.storage.local, not localStorage for sensitive data
- **Testing**: Test across OS/Chrome versions/resolutions
- **Manifest updates**: Keep manifest version current
- **Code complexity**: Modularize, don't over-engineer
- **Extension conflicts**: Some shortcuts may conflict with site functionality

## Sources

### Remote Control Feature Research
- [Media Controller - Chrome Web Store](https://chromewebstore.google.com/detail/media-controller/eaecmocjfoffkdgcgmjfipbnfmakeane?hl=en) (MEDIUM confidence - WebSearch)
- [chrome-media-controller by JosephusPaye - GitHub](https://github.com/JosephusPaye/chrome-media-controller) (HIGH confidence - Official source)
- [chrome-media-controller by jsh9 - GitHub](https://github.com/jsh9/chrome-media-controller) (HIGH confidence - Official source)
- [VLC Mobile Remote - Features](https://vlcmobileremote.com/) (MEDIUM confidence - WebSearch)

### UX Patterns & Best Practices
- [Status indicators – Carbon Design System](https://v10.carbondesignsystem.com/patterns/status-indicator-pattern/) (HIGH confidence - Official design system)
- [5 UX Best Practices To Follow When Designing Status Indicators](https://www.koruux.com/blog/ux-best-practices-designing-status-indicators/) (MEDIUM confidence - WebSearch)
- [4 Ways To Communicate System Status in UI - UX Planet](https://uxplanet.org/4-ways-to-communicate-the-visibility-of-system-status-in-ui-14ff2351c8e8) (MEDIUM confidence - WebSearch)

### Technical Implementation
- [Chrome Extension: How to simulate keypress - OneLinerHub](https://onelinerhub.com/chrome-extension/trigger_key_press) (MEDIUM confidence - WebSearch)
- [Better Chrome Native Video - GitHub](https://github.com/AjaxGb/Better-Chrome-Native-Video) (HIGH confidence - Official source)
- [HTML5 Video Keyboard Shortcuts - Chrome Web Store](https://chromewebstore.google.com/detail/html5-video-keyboard-shor/llhmaciggnibnbdokidmbilklceaobae?hl=en) (MEDIUM confidence - WebSearch)

### Error Handling & Retry Logic
- [Retrying failing jobs - BullMQ](https://docs.bullmq.io/guide/retrying-failing-jobs) (HIGH confidence - Official docs)
- [Retry strategy - Google Cloud Storage](https://docs.google.com/storage/docs/retry-strategy) (HIGH confidence - Official docs)
- [WebSockets and Real-Time Applications - Medium](https://emily-elim04.medium.com/building-real-time-apps-using-websockets-dc137ccdd34b) (LOW confidence - Single source)

### Common Pitfalls
- [5 Common Mistakes to Avoid When Building Chrome Extensions](https://infinitejs.com/posts/common-mistakes-building-chrome-extensions/) (MEDIUM confidence - WebSearch verified)
- [Chrome extensions keyboard shortcut handler - GitHub Gist](https://gist.github.com/SathyaBhat/894012) (MEDIUM confidence - Community pattern)

---

**Research Notes:**
- Most Chrome media controller extensions focus on adding keyboard shortcuts to sites that lack them
- This project is reverse: web app sends commands that extension executes via keyboard simulation
- Real-time acknowledgment is rare in existing extensions (they're input mappers, not remote controls)
- Connection status indicators follow established design system patterns (Carbon, Material)
- Command retry/queue logic borrows from job queue systems (BullMQ) and cloud APIs (Google Cloud)
- Zero existing examples of "web app → extension" remote control pattern found (all are "keyboard → extension → page")
