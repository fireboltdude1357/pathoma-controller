# Pathoma Controller

## What This Is

A remote video playback controller that lets one person control video playback on another person's computer. The web app sends commands (pause, play, skip, speed) that a Chrome extension receives and executes on the target video tab. Built so a girlfriend can control Pathoma study videos playing on her boyfriend's Windows PC while watching via Discord screen share — because his PC has working live captions and hers doesn't.

## Core Value

She can control video playback without interrupting his work flow.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can log in via Clerk authentication
- [ ] Admin can authorize users by adding email to Convex users table
- [ ] User can pause the video
- [ ] User can play the video
- [ ] User can rewind by 1s, 5s, 10s, 30s, or custom amount
- [ ] User can skip forward by 1s, 5s, 10s, 30s, or custom amount
- [ ] User can decrease playback speed (S key)
- [ ] User can increase playback speed (D key)
- [ ] Chrome extension receives commands in real-time via Convex subscription
- [ ] Chrome extension executes commands on pcloud.link video tab
- [ ] Commands execute via keyboard simulation (spacebar for pause/play, arrow keys for skip, S/D for speed)

### Out of Scope

- Video status sync back to web app — she watches via Discord, doesn't need it
- Video selection/navigation — manual for v1, he switches videos himself
- Multiple simultaneous controllers — just one authorized user needed
- Mobile app — web app is sufficient

## Context

- Videos hosted on pcloud.link (URL pattern: `u.pcloud.link/*`)
- His Windows PC has Video Speed Controller extension installed (S = slower, D = faster by 0.1x)
- She watches via Discord screen share from his Windows PC
- His Windows PC's live captions work; her Chrome's don't
- He remote accesses Windows PC from Mac laptop via AnyDesk

## Constraints

- **Tech stack**: Next.js, Convex, Clerk — user specified
- **Browser**: Chrome extension (Windows PC is Chrome)
- **Real-time**: Commands must execute instantly (Convex subscriptions, not polling)
- **Single target**: Extension only needs to work on one pcloud.link tab

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Keyboard simulation over direct player API | Video Speed Controller already uses S/D keys; pcloud player likely uses spacebar/arrows; avoids needing to reverse-engineer player internals | — Pending |
| No status sync | She watches via Discord anyway; simplifies architecture | — Pending |
| Manual user authorization | Simple admin flow; just add email to Convex users table | — Pending |

---
*Last updated: 2025-02-02 after initialization*
