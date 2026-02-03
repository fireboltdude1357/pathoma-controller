# Architecture Patterns: Remote Video Controller

**Domain:** Remote command system with Chrome extension and Convex backend
**Researched:** 2026-02-02
**Confidence:** HIGH

## Recommended Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      USER INTERACTION                        │
└───────────────┬─────────────────────────┬───────────────────┘
                │                         │
                v                         v
    ┌──────────────────────┐   ┌──────────────────────┐
    │   Next.js Web App    │   │  Chrome Extension    │
    │   (Controller UI)    │   │   (Video Context)    │
    │                      │   │                      │
    │  - Clerk Auth        │   │  - Service Worker    │
    │  - Command Buttons   │   │  - Content Script    │
    │  - Convex Client     │   │  - Convex Client     │
    └──────────┬───────────┘   └───────────┬──────────┘
               │                           │
               │   ┌───────────────────┐   │
               └──>│  Convex Backend   │<──┘
                   │                   │
                   │  - Users table    │
                   │  - Commands table │
                   │  - Mutations      │
                   │  - Subscriptions  │
                   └───────────────────┘
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Next.js Web App** | User authentication, command UI, send commands | Convex backend (mutations), Clerk auth |
| **Convex Backend** | Store commands, real-time distribution, user management | Web app (queries/mutations), Extension (subscriptions) |
| **Chrome Service Worker** | Maintain Convex subscription, lifecycle management | Convex backend (subscriptions), Content script (messages) |
| **Chrome Content Script** | Inject into pcloud.link pages, execute commands on video | Service worker (messages), DOM/video element |
| **Clerk Auth** | User authentication and session management | Next.js app, Convex (via JWT) |

### Data Flow

#### Command Creation Flow
```
User clicks "Pause" button in Web App
    → Web app calls Convex mutation with { userId, command: "pause", timestamp }
    → Convex stores command in database
    → Convex subscription triggers in Chrome Extension Service Worker
    → Service Worker sends message to Content Script
    → Content Script calls video.pause() on DOM element
```

#### Real-Time Subscription Flow
```
Extension Service Worker establishes Convex subscription on startup
    → Subscription watches commands table filtered by userId
    → When new command inserted, Convex pushes update to subscription
    → Service Worker receives command via subscription callback
    → Service Worker validates and routes to appropriate Content Script
```

## Patterns to Follow

### Pattern 1: Event-Driven Service Worker
**What:** Service workers in Manifest V3 are ephemeral and event-driven. They start when needed and terminate when idle.

**When:** All Chrome extensions in Manifest V3 must use this pattern.

**Implementation:**
```typescript
// background.ts (Service Worker)
import { ConvexHttpClient } from "convex/browser";

// Register listeners at top level (NOT inside async functions)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true; // Required for async response
});

// State must be stored externally, not in global variables
async function initConvexSubscription() {
  const client = new ConvexHttpClient(CONVEX_URL);

  // Subscribe to user's commands
  const unsubscribe = client.onUpdate(
    api.commands.watchUserCommands,
    { userId: getCurrentUserId() },
    (commands) => {
      // Process new commands
      commands.forEach(cmd => sendCommandToContentScript(cmd));
    }
  );

  // Store subscription handle in chrome.storage, not memory
  await chrome.storage.session.set({ convexSubscribed: true });
}
```

**Why:** Service workers can be terminated at any time. Top-level listener registration ensures Chrome can restart the worker and immediately handle events without waiting for initialization.

**Source:** [Chrome Extension Service Worker Basics](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/basics)

### Pattern 2: Message Passing Between Service Worker and Content Script
**What:** Use chrome.runtime and chrome.tabs APIs for bidirectional communication between extension contexts.

**When:** Whenever service worker needs to send commands to content script, or content script needs to report status.

**Implementation:**
```typescript
// Service Worker: Send to Content Script
async function sendCommandToContentScript(command: Command) {
  const tabs = await chrome.tabs.query({
    url: "https://pcloud.link/*"
  });

  for (const tab of tabs) {
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, {
        type: "EXECUTE_COMMAND",
        payload: command
      });
    }
  }
}

// Content Script: Receive from Service Worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "EXECUTE_COMMAND") {
    const result = executeVideoCommand(message.payload);
    sendResponse({ success: true, result });
  }
  return true; // Enable async response
});

// Content Script: Send to Service Worker
chrome.runtime.sendMessage({
  type: "COMMAND_EXECUTED",
  payload: { commandId: "123", success: true }
});
```

**Why:** Content scripts run in isolated world, separate from service worker. Message passing is the only communication mechanism between these contexts.

**Source:** [Chrome Message Passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)

### Pattern 3: Direct DOM Manipulation via HTMLMediaElement API
**What:** Use native HTML5 video API methods to control playback. Avoid keyboard event simulation.

**When:** Controlling any HTML5 video player programmatically.

**Implementation:**
```typescript
// Content Script: Execute video commands
function executeVideoCommand(command: Command) {
  const video = document.querySelector('video') as HTMLVideoElement;

  if (!video) {
    return { success: false, error: "No video element found" };
  }

  switch (command.action) {
    case "play":
      video.play();
      break;
    case "pause":
      video.pause();
      break;
    case "seek":
      video.currentTime += command.seconds;
      break;
    case "speed":
      video.playbackRate = command.rate;
      break;
  }

  return {
    success: true,
    state: {
      currentTime: video.currentTime,
      paused: video.paused,
      playbackRate: video.playbackRate
    }
  };
}
```

**Why:** Direct API access is more reliable than keyboard event simulation. Simulated keyboard events have `isTrusted: false` and may be ignored by security-conscious video players. The HTMLMediaElement API is the standard interface for all HTML5 video players.

**Sources:**
- [MDN: Video and Audio APIs](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Client-side_web_APIs/Video_and_audio_APIs)
- [HTML5 Video API Guide](https://imagekit.io/blog/html5-video-api/)

### Pattern 4: Convex Real-Time Subscriptions
**What:** Subscribe to Convex queries that automatically update when underlying data changes.

**When:** Whenever you need real-time updates from the database without polling.

**Implementation:**
```typescript
// Web App: Create command
const createCommand = useMutation(api.commands.create);

function handlePauseClick() {
  createCommand({
    userId: user.id,
    action: "pause",
    timestamp: Date.now()
  });
}

// Extension Service Worker: Subscribe to commands
import { ConvexHttpClient } from "convex/browser";

const client = new ConvexHttpClient(CONVEX_URL);

const unsubscribe = client.onUpdate(
  api.commands.watchUserCommands,
  { userId },
  (commands) => {
    const latestCommand = commands[0];
    if (latestCommand) {
      sendCommandToContentScript(latestCommand);
    }
  }
);
```

**Why:** Convex automatically tracks dependencies and pushes updates to subscriptions. No need for WebSockets, polling, or manual subscription management. All subscriptions receive updates at the same logical database snapshot, ensuring consistency.

**Source:** [Convex Real-time Documentation](https://docs.convex.dev/realtime)

### Pattern 5: Convex Schema with User-Command Relationship
**What:** Define Convex schema with foreign key relationship between users and commands.

**When:** Setting up the Convex backend for multi-user command system.

**Implementation:**
```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    createdAt: v.number()
  }).index("by_clerk_id", ["clerkId"]),

  commands: defineTable({
    userId: v.id("users"),
    action: v.union(
      v.literal("play"),
      v.literal("pause"),
      v.literal("seek"),
      v.literal("speed")
    ),
    // Command-specific parameters
    seconds: v.optional(v.number()),    // For seek
    rate: v.optional(v.number()),       // For speed
    timestamp: v.number(),
    executed: v.boolean()
  })
    .index("by_user", ["userId"])
    .index("by_user_timestamp", ["userId", "timestamp"])
});
```

**Why:** Indexes enable efficient queries. The `by_user_timestamp` compound index allows real-time subscriptions to efficiently fetch latest commands for a specific user, sorted by time.

**Source:** [Convex Schemas](https://docs.convex.dev/database/schemas)

### Pattern 6: Clerk + Convex Authentication Integration
**What:** Use Clerk JWT tokens to authenticate Convex requests from both web app and extension.

**When:** Implementing user authentication across Next.js app and Chrome extension.

**Implementation:**
```typescript
// Next.js App: Convex provider with Clerk
import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";

function App({ children }) {
  return (
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_KEY}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}

// Chrome Extension Service Worker: Manual JWT
async function getConvexClient() {
  const session = await chrome.storage.local.get('clerkSession');
  const client = new ConvexHttpClient(CONVEX_URL);

  if (session.token) {
    client.setAuth(session.token);
  }

  return client;
}
```

**Why:** Clerk provides secure authentication with automatic token refresh. Convex's Clerk integration handles JWT validation server-side. Same authentication mechanism works for both web app and extension.

**Source:** Convex documentation (Clerk integration patterns common in ecosystem)

## Anti-Patterns to Avoid

### Anti-Pattern 1: Keyboard Event Simulation
**What:** Using `dispatchEvent(new KeyboardEvent(...))` to simulate key presses on video players.

**Why bad:**
- Events have `isTrusted: false` which many players ignore for security
- Fragile - depends on player's keyboard shortcuts remaining unchanged
- Fails if video player doesn't use keyboard events (API-driven players)
- Debugging is difficult when events are silently ignored

**Instead:** Use HTMLMediaElement API directly (`video.play()`, `video.pause()`, `video.currentTime`, `video.playbackRate`). This works regardless of keyboard shortcut configuration and is the standard, reliable approach.

**Sources:**
- [Chrome Extension Keyboard Event Simulation](https://onelinerhub.com/chrome-extension/trigger_key_press)
- [isTrusted Property Discussion](https://groups.google.com/a/chromium.org/g/chromium-dev/c/94t2J_Jylyw)

### Anti-Pattern 2: Persistent Background Page
**What:** Attempting to use long-lived background pages like in Manifest V2.

**Why bad:**
- Not supported in Manifest V3
- Consumes resources even when extension is idle
- Service workers are terminated after 30 seconds of inactivity
- Global variables are lost when service worker terminates

**Instead:** Design for ephemeral service workers. Store state in `chrome.storage.session` or `chrome.storage.local`. Register all event listeners at the top level of your service worker script. Use Convex subscriptions to maintain data connection, which Convex client handles across service worker restarts.

**Source:** [Migrate to Service Workers](https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers)

### Anti-Pattern 3: Polling for New Commands
**What:** Using setInterval or setTimeout to repeatedly check for new commands.

**Why bad:**
- Wastes network bandwidth and battery
- Introduces latency (commands only execute at poll interval)
- Timers are canceled when service worker terminates
- Requires manual state synchronization

**Instead:** Use Convex subscriptions which push updates immediately when data changes. The Convex client library handles reconnection automatically when service worker restarts.

**Source:** [Convex Real-time](https://docs.convex.dev/realtime)

### Anti-Pattern 4: Storing Secrets in Extension Code
**What:** Hard-coding API keys, Convex deployment URLs, or authentication tokens in extension source.

**Why bad:**
- Extension source code is visible to users (can inspect .crx file)
- Secrets exposed to anyone who installs extension
- Cannot rotate credentials without publishing new extension version

**Instead:**
- Use environment variables for public URLs (Convex deployment URL is public)
- Use Clerk authentication with user-specific JWTs
- Store per-user tokens in chrome.storage.local (encrypted by Chrome)
- For truly sensitive operations, proxy through your Next.js backend

**Source:** Chrome extension security best practices (standard web security)

### Anti-Pattern 5: Directly Coupling Web App and Extension
**What:** Web app and extension communicating directly via chrome.runtime.sendMessage or externally_connectable.

**Why bad:**
- Extension must be installed for web app to function
- Difficult to version API between web app and extension
- Hard to test web app without extension
- Creates tight coupling between deployment cycles

**Instead:** Use Convex as the single source of truth. Web app writes commands to Convex, extension reads from Convex. Both components are independently testable and deployable. The database acts as a clean interface boundary.

**Source:** Architecture patterns for distributed systems

### Anti-Pattern 6: Global Command Queue
**What:** Single commands table shared by all users without userId filtering.

**Why bad:**
- User sees other users' commands
- No way to filter commands efficiently
- Privacy violation
- Cannot scale (query scans entire table)

**Instead:** Always include userId in commands table and use indexed queries (`by_user` or `by_user_timestamp` indexes). Convex subscriptions efficiently watch user-specific command streams.

**Source:** [Convex Relationship Structures](https://stack.convex.dev/relationship-structures-let-s-talk-about-schemas)

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|--------------|--------------|-------------|
| **Command latency** | <100ms (single region) | <100ms (Convex auto-scales) | <100ms (add edge caching if needed) |
| **Convex subscriptions** | No optimization needed | No optimization needed | Convex handles (built for this scale) |
| **Chrome extension** | Single service worker per user | Single service worker per user | No change (client-side) |
| **Database size** | Commands can be deleted after execution | Add TTL cleanup mutation | Add automatic archival (move old commands to archive table) |
| **Authentication** | Clerk standard plan | Clerk standard plan | Clerk enterprise (100K+ MAUs) |
| **Costs** | ~$25/month (Convex free tier + Clerk) | ~$125/month (Convex Pro) | Custom pricing (Convex Enterprise) |

### Database Cleanup Strategy

Commands should be marked as `executed: true` and cleaned up after a reasonable delay:

```typescript
// convex/commands.ts
export const cleanup = internalMutation({
  handler: async (ctx) => {
    const oldExecuted = await ctx.db
      .query("commands")
      .withIndex("by_timestamp")
      .filter(q =>
        q.and(
          q.eq(q.field("executed"), true),
          q.lt(q.field("timestamp"), Date.now() - 24 * 60 * 60 * 1000)
        )
      )
      .collect();

    for (const cmd of oldExecuted) {
      await ctx.db.delete(cmd._id);
    }
  }
});
```

Schedule this cleanup mutation to run daily via Convex cron or external scheduler.

## Build Order Implications

Based on component dependencies, recommend this build sequence:

### Phase 1: Core Backend
1. Convex schema definition (users, commands tables)
2. Convex mutations (create command, mark executed)
3. Convex queries (watch user commands)
4. Clerk authentication setup

**Why first:** Both web app and extension depend on backend. Can test with Convex dashboard.

**Can deploy independently:** Yes

### Phase 2: Web Controller App
1. Next.js app with Clerk authentication
2. Convex provider integration
3. Command button UI
4. Command creation via mutations

**Why second:** Easier to develop and test than extension. Can verify backend works by watching Convex dashboard.

**Can deploy independently:** Yes (but pointless without extension)

### Phase 3: Chrome Extension Foundation
1. Manifest v3 configuration
2. Service worker with Convex client
3. Real-time subscription to commands
4. chrome.storage for session management

**Why third:** Requires working backend to test subscriptions.

**Can deploy independently:** No (needs Phase 1)

### Phase 4: Video Control Implementation
1. Content script injection on pcloud.link
2. Video element detection
3. HTMLMediaElement API integration
4. Command execution handlers
5. Status reporting back to service worker

**Why fourth:** Requires extension foundation from Phase 3.

**Can deploy independently:** No (needs Phase 3)

### Phase 5: Integration & Polish
1. End-to-end testing (web app → Convex → extension → video)
2. Error handling and retry logic
3. User feedback (command acknowledged, executed)
4. Multi-tab handling (multiple videos open)

**Why last:** Requires all components working.

**Testing strategy:**
- Use Convex dashboard to inject test commands
- Test extension without web app using direct Convex mutations
- Test web app command creation separately from extension execution

## Alternative Architectures Considered

### Alternative 1: WebSocket Backend
**What:** Custom WebSocket server instead of Convex.

**Rejected because:**
- Must implement subscription management manually
- Must handle reconnection logic
- Must implement authentication
- Must provision and scale servers
- Convex provides all of this out-of-box

### Alternative 2: Extension-Only (No Web App)
**What:** Control video from extension popup instead of web app.

**Rejected because:**
- Poor UX (must have video tab open and visible)
- Cannot control from mobile device
- Extension popup closes automatically (poor for persistent controls)
- Web app provides better control experience

### Alternative 3: Direct Messaging Between Web App and Extension
**What:** Use chrome.runtime.sendMessage with externally_connectable.

**Rejected because:**
- Extension must be installed for web app to work
- Complex to handle extension not installed case
- Tight coupling between components
- Difficult to test in isolation
- Convex provides clean separation

## Sources

**HIGH Confidence (Official Documentation):**
- [Chrome Extension Service Worker Basics](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/basics)
- [Chrome Message Passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)
- [Manifest V3 Migration](https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers)
- [Convex Real-time](https://docs.convex.dev/realtime)
- [Convex Schemas](https://docs.convex.dev/database/schemas)
- [MDN: Video and Audio APIs](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Client-side_web_APIs/Video_and_audio_APIs)

**MEDIUM Confidence (Community + Official Sources):**
- [Chrome Extension Architecture Guide 2026](https://jinlow.medium.com/chrome-extension-development-the-complete-system-architecture-guide-for-2026-9ae81415f93e)
- [Convex Chrome Extension Example](https://github.com/ianmacartney/ts-chrome-extension-search-history)
- [Convex Relationship Structures](https://stack.convex.dev/relationship-structures-let-s-talk-about-schemas)
- [HTML5 Video API Guide](https://imagekit.io/blog/html5-video-api/)

**LOW Confidence (Community-only, noted as verification needed):**
- Keyboard event isTrusted property discussions (verified against multiple sources showing consistent information)
