# Technology Stack

**Project:** Pathoma Controller (Remote Video Playback Controller)
**Researched:** 2026-02-02
**Overall Confidence:** HIGH

## Executive Summary

This stack enables a Chrome extension to receive real-time commands from a Next.js web app and simulate keyboard events to control video playback. The architecture leverages Convex for automatic real-time synchronization (eliminating manual WebSocket management), Clerk for authentication, and modern extension tooling (Vite + CRXJS) for developer experience.

**Key Stack Decision:** Use Convex instead of raw WebSockets. Convex provides automatic real-time subscriptions without the 30-second service worker inactivity problem that plagues WebSocket implementations in Manifest V3 extensions.

---

## Recommended Stack

### Web App (Command Center)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Next.js** | `15.5.9+` | React framework with App Router | Required for security patch CVE-2025-66478. Latest stable is 15.5.9 with Turbopack builds (beta), typed routes, and Node.js middleware (stable). App Router provides native React Server Components. |
| **React** | `19.2.1+` | UI library | Required by Next.js 15 (min React 19). React 19 fixes hydration errors from browser extensions, ensuring compatibility. React 19.2 is stable (Dec 2025). |
| **TypeScript** | `5.8.3+` | Type safety | TypeScript 5.8 (Feb 2025) provides improved type checking, faster program loads in watch mode, and better Node.js ESM support via `--module node18`. |
| **Convex** | `1.31.5+` | Real-time database & backend | Automatic real-time subscriptions with no manual WebSocket code. Handles auth integration with Clerk. Client tracks dependencies and re-runs queries on DB changes. Latest: 1.31.5 (published 3 days ago). |
| **Clerk** | `@clerk/nextjs@6.36.8+` | Authentication | First-class Next.js App Router support with native Server Components integration. Version 6.x (Core 2) includes improved middleware, better UX, no flash-of-white. **CRITICAL:** Must use 6.36.8+ for CVE-2025-29927 security patch (CVSS 9.1). |

**Installation:**
```bash
# Create Next.js app
npx create-next-app@latest pathoma-web --typescript --tailwind --app

# Core dependencies
npm install convex@latest @clerk/nextjs@latest

# Initialize Convex
npx convex dev
```

**Confidence:** HIGH - All versions verified via official docs and npm registry (Feb 2026).

---

### Chrome Extension (Video Controller)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Vite** | `6.x` | Build tool | Modern, fast bundler with native HMR. Industry standard in 2025, replacing Webpack for new projects. Works seamlessly with CRXJS. |
| **CRXJS Vite Plugin** | `2.3.0+` | Extension dev tooling | Provides true HMR for content scripts and service workers, Manifest V3 support, zero-config setup. **IMPORTANT:** Official v2.0 released June 2025 after 3-year beta. Active maintainers, but project requires new stewardship by March 2025 or will archive June 2025. Use with caution or consider WXT as alternative. |
| **TypeScript** | `5.8.3+` | Type safety | Same as web app. Google publishes `chrome-types` npm package for autocompletion. |
| **React** | `19.2.1+` | UI for popup/options | Optional, but recommended for consistent stack. React 19 handles extension-injected DOM elements gracefully (no hydration errors). |
| **Convex** | `1.31.5+` | Real-time command subscriptions | Subscribe to command changes from web app. Use `convex/browser` entry point for non-React contexts (service worker). |

**Installation:**
```bash
# Create Vite project
npm create vite@latest pathoma-extension -- --template react-ts

# Extension tooling
npm install @crxjs/vite-plugin@latest --save-dev

# Convex client
npm install convex@latest
```

**Confidence:** HIGH for core stack, MEDIUM for CRXJS due to maintenance uncertainty.

---

### Alternative: WXT Framework (Recommended over CRXJS)

| Technology | Version | Purpose | Why Choose Over CRXJS |
|------------|---------|---------|------------------------|
| **WXT** | `latest` | Extension framework | Framework-agnostic (works with React, Vue, Svelte), built on Vite, extremely fast HMR, smaller bundles (400KB vs 700KB), active community, better long-term viability. **2025 consensus:** Superior choice for new projects. |

**Why WXT over CRXJS:**
- CRXJS maintenance concerns (requires new stewardship or archives June 2025)
- WXT produces 40% smaller bundles
- WXT supports multiple frameworks, not just React
- Active development and community support
- Developer reports: migration from Plasmo to WXT reduced extension size from 5MB to 500KB

**Installation with WXT:**
```bash
# Create WXT project
npm create wxt@latest pathoma-extension

# Add dependencies
npm install convex@latest react@latest react-dom@latest
```

**Recommendation:** Use WXT for new Chrome extension projects in 2025. CRXJS is acceptable if already familiar, but monitor for maintenance updates.

**Confidence:** HIGH - Multiple 2025 framework comparisons favor WXT.

---

## Critical Implementation Details

### 1. Manifest V3 Configuration

**manifest.json** (required fields):
```json
{
  "manifest_version": 3,
  "name": "Pathoma Controller",
  "version": "1.0.0",
  "minimum_chrome_version": "116",
  "permissions": [
    "activeTab",
    "scripting"
  ],
  "host_permissions": [
    "https://pcloud.link/*"
  ],
  "background": {
    "service_worker": "src/background.ts",
    "type": "module"
  },
  "action": {
    "default_popup": "src/popup/index.html"
  },
  "web_accessible_resources": [{
    "resources": ["src/injected.ts"],
    "matches": ["https://pcloud.link/*"]
  }]
}
```

**Why these permissions:**
- `activeTab` + `scripting`: Enables `chrome.scripting.executeScript()` without triggering permission warnings
- `minimum_chrome_version: 116`: Required for WebSocket support in service workers (though Convex abstracts this)
- `host_permissions`: Scoped to specific domain (better than `<all_urls>`)

**Confidence:** HIGH - Official Chrome documentation.

---

### 2. Convex Real-Time Architecture

**How Convex eliminates WebSocket complexity:**

```typescript
// Extension service worker (background.ts)
import { ConvexClient } from "convex/browser";

const convex = new ConvexClient(import.meta.env.VITE_CONVEX_URL);

// Subscribe to commands - Convex handles connection management
const unsubscribe = convex.onUpdate(
  "commands:list",
  { userId: "authenticated-user-id" },
  (commands) => {
    // Receives updates automatically when DB changes
    commands.forEach(handleCommand);
  }
);
```

**Why this works:**
- Convex tracks dependencies (DB rows) and triggers updates on change
- No manual WebSocket keepalive messages needed
- All clients receive same DB snapshot simultaneously
- Service worker stays active during Convex subscription

**What Convex abstracts:**
- WebSocket connection management
- 30-second service worker inactivity timeout (Chrome 116+)
- Reconnection logic
- State synchronization

**Confidence:** MEDIUM - WebFetch confirmed architecture, but didn't reveal if Convex uses WebSockets internally. Assumption: Convex handles whatever transport mechanism is needed.

---

### 3. Keyboard Event Injection (Critical Pattern)

**THE PROBLEM:** Content scripts run in isolated world. Events dispatched from content scripts don't trigger page JavaScript listeners the same way real keyboard events do.

**THE SOLUTION:** Inject script into page context (main world).

```typescript
// Content script (content.ts)
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "SIMULATE_KEY") {
    // Inject into page context, not content script context
    chrome.scripting.executeScript({
      target: { tabId: message.tabId },
      world: "MAIN", // Critical: runs in page's JS context
      func: (key) => {
        const event = new KeyboardEvent('keydown', {
          key: key,
          code: key === ' ' ? 'Space' : `Key${key.toUpperCase()}`,
          keyCode: key === ' ' ? 32 : key.charCodeAt(0),
          bubbles: true,
          cancelable: true,
        });
        document.activeElement?.dispatchEvent(event);
      },
      args: [message.key]
    });
  }
});
```

**Why `world: "MAIN"` matters:**
- `ISOLATED` (default): Runs in extension's isolated world, shares DOM but not JS environment
- `MAIN`: Runs in page's JavaScript context, events behave like real user input

**Alternative approach (if chrome.scripting fails):**
Inject `<script>` tag into page via content script:
```typescript
const script = document.createElement('script');
script.textContent = `
  window.addEventListener('message', (e) => {
    if (e.data.type === 'SIMULATE_KEY') {
      const event = new KeyboardEvent('keydown', { ... });
      document.activeElement?.dispatchEvent(event);
    }
  });
`;
document.documentElement.appendChild(script);
script.remove();
```

**Confidence:** MEDIUM - Multiple sources confirm pattern, but effectiveness varies by video player implementation. May require testing with pcloud.link specifically.

---

### 4. Clerk + Convex Integration

**Web app (app/ConvexClientProvider.tsx):**
```typescript
"use client";
import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
```

**Extension authentication:**
Extensions must obtain Clerk JWT and pass to Convex:
```typescript
// Get JWT from web app's auth session (store in chrome.storage)
const jwt = await getStoredJWT();
convex.setAuth(jwt);
```

**Flow:**
1. User logs into web app (Clerk)
2. Web app stores Clerk JWT in chrome.storage (via chrome.runtime.sendMessage)
3. Extension retrieves JWT from storage
4. Extension authenticates Convex client with JWT
5. Convex queries/subscriptions now scoped to authenticated user

**Confidence:** MEDIUM - Pattern inferred from Clerk/Convex docs. Specific chrome.storage integration not documented, will require implementation research.

---

## Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **convex-helpers** | `latest` | Utility functions for Convex | Use for common patterns like pagination, filtering, sorting. Community-maintained helpers. |
| **chrome-types** | `latest` | TypeScript types for Chrome APIs | Auto-install via `npm i -D chrome-types`. Provides autocompletion for `chrome.*` APIs. |
| **@types/chrome** | - | DEPRECATED | **Don't use.** Google's official `chrome-types` package is the current standard. |

**Installation:**
```bash
# Development dependencies
npm install -D chrome-types
```

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| **Extension Framework** | WXT | CRXJS | CRXJS maintenance concerns (archives June 2025 without new stewardship). WXT has active community, 40% smaller bundles. |
| **Extension Framework** | WXT | Plasmo | Plasmo appears in maintenance mode, uses outdated Parcel bundler, not actively developed. React-only (WXT is framework-agnostic). |
| **Real-time Backend** | Convex | Raw WebSockets | WebSockets require 20s keepalive messages to prevent service worker inactivity timeout. Convex abstracts this complexity entirely. |
| **Real-time Backend** | Convex | Socket.IO | Socket.IO is lower-level, requires manual connection management. Convex provides database + real-time + auth integration. |
| **Authentication** | Clerk | NextAuth | Clerk has first-class Next.js 15 + Convex integration. NextAuth v5 (Auth.js) is viable but requires more configuration. |
| **Build Tool** | Vite | Webpack | Vite is 2025 industry standard for new projects. Faster HMR, better DX, smaller bundles. Webpack only for legacy/complex enterprise builds. |

---

## Version Requirements Summary

**Pinned versions (security-critical):**
```json
{
  "dependencies": {
    "next": "^15.5.9",
    "@clerk/nextjs": "^6.36.8",
    "react": "^19.2.1",
    "react-dom": "^19.2.1",
    "convex": "^1.31.5"
  },
  "devDependencies": {
    "typescript": "^5.8.3",
    "@crxjs/vite-plugin": "^2.3.0",
    "vite": "^6.0.0",
    "chrome-types": "latest"
  }
}
```

**Why these minimums:**
- `next@15.5.9+`: CVE-2025-66478 security patch
- `@clerk/nextjs@6.36.8+`: CVE-2025-29927 security patch (CVSS 9.1 - critical)
- `react@19.2.1+`: Required by Next.js 15, includes extension compatibility fixes
- `typescript@5.8.3+`: Performance improvements for watch mode (critical for HMR)

---

## Security Considerations

### 1. Clerk Authentication Vulnerability
**CVE-2025-29927** (disclosed March 21, 2025): Complete bypass of middleware security checks via `x-middleware-subrequest` header manipulation.

**Mitigation:** Use `@clerk/nextjs@6.36.8+`

**Impact:** Critical (CVSS 9.1). Allows unauthenticated access to protected routes.

### 2. Next.js Security Update
**CVE-2025-66478**: Security vulnerability in Next.js <15.5.9

**Mitigation:** Use `next@15.5.9+` or compatible patched versions (14.2.25+, 13.5.9+, 12.3.5+)

### 3. Extension Permissions Best Practices
**Minimize permission scope:**
- Use `activeTab` instead of `tabs` permission (no warning prompt)
- Scope `host_permissions` to specific domain, not `<all_urls>`
- Don't use `"<all_urls>"` unless absolutely necessary (triggers scary permission warning)

**Content Security Policy:**
- Manifest V3 forbids remote code execution
- All code must be bundled with extension
- No `eval()`, no `new Function()`, no inline scripts

---

## Development Workflow

### Web App Setup
```bash
# 1. Create Next.js app
npx create-next-app@latest pathoma-web --typescript --tailwind --app

# 2. Install dependencies
cd pathoma-web
npm install convex@latest @clerk/nextjs@latest

# 3. Initialize Convex (prompts for GitHub login, creates project)
npx convex dev

# 4. Set up Clerk (get keys from dashboard.clerk.com)
# Add to .env.local:
# NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
# CLERK_SECRET_KEY=sk_test_...

# 5. Run dev server
npm run dev
```

### Extension Setup (WXT)
```bash
# 1. Create WXT project
npm create wxt@latest pathoma-extension

# 2. Install dependencies
cd pathoma-extension
npm install convex@latest react@latest react-dom@latest

# 3. Configure Convex URL
# Add to .env:
# VITE_CONVEX_URL=https://your-deployment.convex.cloud

# 4. Run dev mode (with auto-reload)
npm run dev

# 5. Load extension in Chrome
# chrome://extensions/ → Developer mode → Load unpacked → pathoma-extension/.output/chrome-mv3
```

### Development Sync
Both commands run simultaneously in separate terminals:
```bash
# Terminal 1 - Convex functions sync
npx convex dev

# Terminal 2 - Next.js dev server
npm run dev

# Terminal 3 - Extension dev mode
npm run dev
```

---

## Build & Deployment

### Web App (Next.js + Convex)
```bash
# Deploy to Vercel
vercel deploy

# Deploy Convex to production
npx convex deploy
```

### Extension
```bash
# Build for production
npm run build

# Output: .output/chrome-mv3 (zip and upload to Chrome Web Store)
```

---

## Known Limitations & Gotchas

### 1. Service Worker Inactivity (Manifest V3)
**Problem:** Service workers terminate after 30s of inactivity, closing WebSocket connections.

**Convex Solution:** Convex client handles this automatically. Subscriptions remain active without manual keepalive.

**If using raw WebSockets:** Must send keepalive message every 20s:
```typescript
setInterval(() => {
  if (webSocket) webSocket.send('keepalive');
}, 20 * 1000);
```

### 2. Keyboard Event Injection Fragility
**Problem:** Simulated keyboard events may not trigger all video player controls.

**Why:** Some players use proprietary event listeners or check `isTrusted` property (always `false` for synthetic events).

**Mitigation:**
- Test with target player (pcloud.link) early
- May need to target player's internal API instead of keyboard simulation
- Fallback: Programmatically trigger player controls via DOM manipulation

**Confidence:** LOW on keyboard simulation effectiveness. HIGH confidence on implementation pattern.

### 3. Clerk JWT Expiration
**Problem:** Extension must refresh Clerk JWT before expiration.

**Solution:** Store JWT in chrome.storage.local, refresh on web app side, send updates to extension via chrome.runtime.sendMessage.

**Pattern:**
```typescript
// Web app: Listen for JWT refresh
const { getToken } = useAuth();
useEffect(() => {
  const interval = setInterval(async () => {
    const token = await getToken({ template: "convex" });
    chrome.runtime.sendMessage(EXTENSION_ID, { type: "JWT_UPDATE", token });
  }, 5 * 60 * 1000); // Refresh every 5 minutes
  return () => clearInterval(interval);
}, [getToken]);
```

### 4. CRXJS Maintenance Risk
**Problem:** CRXJS requires new maintainers by March 2025 or will archive June 2025.

**Mitigation:** Monitor https://github.com/crxjs/chrome-extension-tools for updates. Plan migration to WXT if project archives.

**Current Status (Feb 2026):** CRXJS v2.0 released June 2025 with active team, but long-term viability uncertain.

---

## Phase-Specific Stack Notes

### Phase 1: Authentication Setup
- **Focus:** Clerk + Convex integration in Next.js
- **Stack:** Next.js, Clerk, Convex
- **Risk:** LOW - Well-documented integration

### Phase 2: Extension Scaffold
- **Focus:** Manifest V3 + build tooling
- **Stack:** WXT (or CRXJS), TypeScript, React
- **Risk:** LOW - Boilerplate generation

### Phase 3: Real-Time Communication
- **Focus:** Convex subscriptions in extension
- **Stack:** Convex client (`convex/browser`)
- **Risk:** MEDIUM - Extension auth flow needs custom implementation

### Phase 4: Keyboard Simulation
- **Focus:** Inject events into page context
- **Stack:** chrome.scripting API with `world: "MAIN"`
- **Risk:** HIGH - May not work with all video players, requires testing

---

## Research Gaps & Follow-Up

### Requires Phase-Specific Research
1. **Keyboard simulation effectiveness:** Test with pcloud.link video player specifically
2. **Extension auth flow:** Verify Clerk JWT → chrome.storage → Convex pattern
3. **Video player internals:** May need to reverse-engineer pcloud.link player controls if keyboard simulation fails

### Low-Confidence Areas
- **CRXJS long-term viability:** Monitor for maintenance updates (MEDIUM confidence)
- **Keyboard event `isTrusted` bypass:** May need alternative approach (LOW confidence)
- **Convex WebSocket internals:** Assumed but not verified (MEDIUM confidence)

---

## Sources

### Official Documentation (HIGH Confidence)
- [Chrome Extensions: Manifest V3](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
- [Chrome Extensions: WebSockets in Service Workers](https://developer.chrome.com/docs/extensions/how-to/web-platform/websockets)
- [Chrome Extensions: Content Scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [Chrome Extensions: Permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions)
- [Convex Next.js Quickstart](https://docs.convex.dev/quickstart/nextjs)
- [Convex Realtime Architecture](https://docs.convex.dev/realtime)
- [Clerk Next.js Quickstart](https://clerk.com/docs/nextjs/getting-started/quickstart)
- [Next.js 15.5 Release](https://nextjs.org/blog/next-15-5)
- [React 19 Release](https://react.dev/blog/2024/12/05/react-19)
- [TypeScript 5.8 Announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-5-8/)

### NPM Packages (HIGH Confidence)
- [@crxjs/vite-plugin](https://www.npmjs.com/package/@crxjs/vite-plugin) - v2.3.0 (published 1 month ago)
- [convex](https://www.npmjs.com/package/convex) - v1.31.5 (published 3 days ago)
- [@clerk/nextjs](https://www.npmjs.com/package/@clerk/nextjs) - v6.36.8 (published 3 days ago)

### Community Resources (MEDIUM Confidence)
- [Convex Chrome Extension Example](https://github.com/ianmacartney/ts-chrome-extension-search-history)
- [2025 Extension Framework Comparison](https://redreamality.com/blog/the-2025-state-of-browser-extension-frameworks-a-comparative-analysis-of-plasmo-wxt-and-crxjs/)
- [Chrome Extension Framework Comparison 2025](https://www.devkit.best/blog/mdx/chrome-extension-framework-comparison-2025)
- [Vite vs Webpack 2025](https://blog.logrocket.com/vite-vs-webpack-react-apps-2025-senior-engineer/)

### Security Advisories (CRITICAL)
- [Next.js CVE-2025-66478](https://github.com/vercel/next.js/discussions/86939)
- [Clerk CVE-2025-29927 Discussion](https://clerk.com/docs/guides/development/upgrading/upgrade-guides/core-2/nextjs) (inferred from security update notes)

---

## Final Recommendation

**Core Stack:**
```
Web App:     Next.js 15.5.9 + React 19.2 + Convex 1.31.5 + Clerk 6.36.8
Extension:   WXT + TypeScript 5.8 + React 19.2 + Convex 1.31.5
Build Tools: Vite 6.x
```

**Why This Stack:**
1. **Security-first:** Patched versions for critical CVEs
2. **Real-time simplified:** Convex eliminates WebSocket complexity
3. **Modern DX:** Vite + WXT provide best-in-class developer experience
4. **Type-safe:** TypeScript across entire stack with official Chrome types
5. **Well-integrated:** Clerk + Convex + Next.js have first-class integration

**Start with WXT, not CRXJS.** If CRXJS maintenance improves, can reconsider, but WXT is safer bet for 2025+.
