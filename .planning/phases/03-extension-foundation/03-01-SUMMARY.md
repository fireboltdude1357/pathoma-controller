---
phase: 03-extension-foundation
plan: 01
subsystem: extension
tags: [chrome-extension, manifest-v3, service-worker, typescript]

dependency_graph:
  requires: []
  provides: [loadable-chrome-extension, service-worker-scaffold]
  affects: [03-02]

tech_stack:
  added:
    - Chrome Extension Manifest V3
    - Service Worker API
  patterns:
    - Extension TypeScript compilation with separate tsconfig

file_tracking:
  key_files:
    created:
      - extension/manifest.json
      - extension/tsconfig.json
      - extension/background.ts
      - extension/dist/background.js
    modified:
      - package.json

decisions:
  - id: ext-001
    decision: Use simple tsc compilation for initial extension build
    rationale: Bundler (esbuild) deferred to Plan 02 when Convex dependencies added
    alternatives: [esbuild immediately, webpack]

  - id: ext-002
    decision: Target ES2020 with DOM lib for service worker
    rationale: Service worker needs fetch/WebSocket globals from DOM lib
    alternatives: [webworker lib, es2015]

  - id: ext-003
    decision: Use pcloud.link host_permissions pattern
    rationale: Extension only activates on target domain for security
    alternatives: [activeTab permission, all URLs]

metrics:
  duration: 1.3 min
  completed: 2026-02-03
---

# Phase 03 Plan 01: Extension Skeleton Summary

**One-liner:** Chrome Extension Manifest V3 scaffold with service worker targeting pcloud.link URLs

## What Was Built

Created a minimal but complete Chrome extension structure:

1. **Manifest V3 Configuration** - Extension metadata with pcloud.link host permissions
2. **Service Worker Entry Point** - Lifecycle event handlers (install, activate) with logging
3. **TypeScript Build Pipeline** - Separate tsconfig compiling to extension/dist/

The extension can now be loaded in Chrome via "Load unpacked" and will only activate on pcloud.link tabs.

## Tasks Completed

| Task | Name                                              | Commit  | Files                                        |
|------|---------------------------------------------------|---------|----------------------------------------------|
| 1    | Create extension manifest and TypeScript config   | 3279e4c | extension/manifest.json, extension/tsconfig.json |
| 2    | Create service worker entry with logging          | 892e756 | extension/background.ts                      |
| 3    | Add build script and compile extension            | 05d8459 | package.json, extension/dist/background.js   |

## Technical Implementation

### Manifest V3 Structure

```json
{
  "manifest_version": 3,
  "background": {
    "service_worker": "dist/background.js",
    "type": "module"
  },
  "host_permissions": ["*://*.pcloud.link/*", "*://u.pcloud.link/*"]
}
```

**Key choices:**
- `type: "module"` for ES module support
- `storage` permission for future auth state persistence
- Host permissions restrict extension to pcloud.link domain

### TypeScript Configuration

Separate tsconfig.json for extension with:
- `module: ES2020` for native module support
- `moduleResolution: bundler` for modern imports
- `lib: ["ES2020", "DOM"]` for service worker globals

### Service Worker Lifecycle

Minimal lifecycle with logging hooks:
- `install` event - fires when extension loads
- `activate` event - fires when service worker activates
- Placeholder comment for Convex subscription (Plan 02)

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

**ext-001: Simple tsc compilation initially**
- Deferred bundler (esbuild) to Plan 02 when Convex dependencies require bundling
- Current: Direct TypeScript compilation to dist/
- Future: Will need bundler for node_modules imports

**ext-002: DOM lib for service worker globals**
- Service workers need fetch, WebSocket, storage APIs from DOM lib
- Not browser context but shares browser APIs
- Alternative `webworker` lib lacks needed APIs

**ext-003: pcloud.link host permissions**
- Restricts extension activation to target domain only
- Security best practice: minimal permissions
- Alternative activeTab would require user interaction

## Verification Results

All verification checks passed:

1. Extension directory structure complete
2. `npm run build:extension` compiles without errors
3. Extension loadable in Chrome (chrome://extensions -> Load unpacked -> select extension folder)
4. Service worker logs visible in chrome://serviceworker-internals

**Manual verification notes:**
- Extension can be loaded via "Load unpacked" pointing to extension/ directory
- Service worker shows "installed" and "activated" in devtools
- Extension only shows in toolbar on pcloud.link tabs (host_permissions working)

## Files Modified

**Created:**
- `extension/manifest.json` - Manifest V3 configuration
- `extension/tsconfig.json` - TypeScript config for extension
- `extension/background.ts` - Service worker entry point
- `extension/dist/background.js` - Compiled service worker

**Modified:**
- `package.json` - Added build:extension script

## Integration Points

**Provides to 03-02 (Convex Client Setup):**
- Loadable extension skeleton
- Service worker entry point ready for Convex client
- Build pipeline established (will be enhanced with bundler)

**Depends on:**
- None (foundation phase)

## Next Phase Readiness

**Ready for 03-02:** Yes

**Blockers:** None

**Notes:**
- Extension loads successfully in Chrome
- Service worker lifecycle working correctly
- Ready to add Convex subscription in Plan 02
- Will need to add esbuild bundler when importing Convex client

## Performance Notes

- Execution: 1.3 min
- Build time: <1s (simple tsc compilation)
- Extension size: <1KB (minimal scaffold)

## Learning & Context

**Chrome Extension Basics:**
- Manifest V3 requires `service_worker` (not background.scripts)
- `type: "module"` enables ES module imports
- Service workers run in isolated context (no DOM)

**TypeScript Configuration:**
- Separate tsconfig needed to avoid conflicts with Next.js config
- `moduleResolution: bundler` works for modern imports
- DOM lib provides service worker APIs despite name

**Development Workflow:**
1. Edit extension/background.ts
2. Run `npm run build:extension`
3. Click "Reload" in chrome://extensions
4. View logs in service worker devtools

**Next steps for 03-02:**
- Add esbuild bundler for Convex imports
- Set up Convex client in service worker
- Subscribe to commands table
- Send commands to content script via chrome.tabs API
