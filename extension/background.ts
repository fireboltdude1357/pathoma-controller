// Service worker lifecycle
console.log('[Pathoma Controller] Service worker starting');

// Listen for install
self.addEventListener('install', () => {
  console.log('[Pathoma Controller] Service worker installed');
});

// Listen for activate
self.addEventListener('activate', () => {
  console.log('[Pathoma Controller] Service worker activated');
});

// Placeholder for Convex subscription (Plan 02)
// Will be replaced with actual Convex client setup

export {};
