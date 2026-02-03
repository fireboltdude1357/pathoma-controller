import { subscribeToCommands, getConvexClient, api } from './convex-client';

console.log('[Pathoma Controller] Service worker starting');

// State management via chrome.storage for persistence across restarts
interface ExtensionState {
  lastCommandId: string | null;
  connected: boolean;
}

async function getState(): Promise<ExtensionState> {
  const result = await chrome.storage.local.get(['lastCommandId', 'connected']);
  return {
    lastCommandId: (result.lastCommandId as string | undefined) ?? null,
    connected: (result.connected as boolean | undefined) ?? false,
  };
}

async function setState(updates: Partial<ExtensionState>): Promise<void> {
  await chrome.storage.local.set(updates);
}

// Track subscription for cleanup
let unsubscribe: (() => void) | null = null;

async function startSubscription(): Promise<void> {
  // Clean up existing subscription
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }

  const state = await getState();
  console.log('[Pathoma Controller] Starting subscription, last command:', state.lastCommandId);

  unsubscribe = subscribeToCommands(async (command) => {
    // Skip if we've already processed this command
    if (command._id === state.lastCommandId) {
      console.log('[Pathoma Controller] Skipping already processed command');
      return;
    }

    console.log('[Pathoma Controller] New command:', command.type, command.amount);

    // Store the command ID to prevent re-processing after restart
    await setState({ lastCommandId: command._id });

    // Forward command to content script on pcloud.link tabs
    try {
      const tabs = await chrome.tabs.query({ url: '*://*.pcloud.link/*' });

      if (tabs.length === 0) {
        console.warn('[Pathoma Controller] No pcloud.link tab found');
        return;
      }

      // Send to first matching tab (all frames)
      const tab = tabs[0];
      if (tab.id) {
        // Get all frames in the tab
        const frames = await chrome.webNavigation.getAllFrames({ tabId: tab.id });
        if (frames) {
          for (const frame of frames) {
            try {
              const response = await chrome.tabs.sendMessage(
                tab.id,
                { type: command.type, amount: command.amount },
                { frameId: frame.frameId }
              );
              console.log(`[Pathoma Controller] Command executed in frame ${frame.frameId}:`, response);
            } catch (e) {
              // Content script not loaded in this frame, skip
            }
          }
        }
      }
    } catch (error) {
      console.error('[Pathoma Controller] Failed to send command to content script:', error);
    }
  });

  await setState({ connected: true });
  console.log('[Pathoma Controller] Subscription active');
}

// Service worker lifecycle
self.addEventListener('install', () => {
  console.log('[Pathoma Controller] Service worker installed');
});

self.addEventListener('activate', () => {
  console.log('[Pathoma Controller] Service worker activated');
  // Start subscription on activate
  startSubscription().catch(err => {
    console.error('[Pathoma Controller] Failed to start subscription:', err);
  });
});

// Handle service worker wakeup (e.g., from chrome.storage changes, alarms, etc.)
// The subscription will automatically reconnect when the client is used
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    console.log('[Pathoma Controller] Storage changed:', Object.keys(changes));
  }
});

// Keep-alive: Use chrome.alarms to periodically wake the service worker
// This ensures the Convex WebSocket stays connected
chrome.alarms.create('keepalive', { periodInMinutes: 0.5 }); // Every 30 seconds

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepalive') {
    // Check if subscription is active, restart if needed
    if (!unsubscribe) {
      console.log('[Pathoma Controller] Restarting subscription after alarm');
      startSubscription().catch(console.error);
    }
  }
});

// Start subscription immediately on load
startSubscription().catch(console.error);

export {};
