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
export {};
