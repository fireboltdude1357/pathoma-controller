# HTMLMediaElement API Test Snippets for pcloud.link

Copy-paste these snippets into browser devtools console to test HTMLMediaElement API feasibility.

## 1. Video Element Discovery

```javascript
// Find video element (most common case)
const v = document.querySelector('video');
console.log('Video element:', v);
// Expected: HTMLVideoElement object

// If null, check for iframes
const iframes = document.querySelectorAll('iframe');
console.log('Found iframes:', iframes.length);

// If in iframe, try accessing (will fail if cross-origin)
// const iframe = document.querySelector('iframe');
// const v = iframe.contentDocument.querySelector('video');

// Check for shadow DOM
// const host = document.querySelector('[shadow-host-selector]');
// const v = host.shadowRoot.querySelector('video');

// Store reference for subsequent tests
window.testVideo = v;
console.log('Stored as window.testVideo');
```

## 2. Basic Controls Test

```javascript
const v = window.testVideo || document.querySelector('video');

// Test pause
v.pause();
console.log('Paused. Playing:', !v.paused);
// Expected: false (video should stop)

// Test play (returns a Promise)
v.play().then(() => {
  console.log('Playing:', !v.paused);
}).catch(err => {
  console.error('Play failed:', err);
});
// Expected: true (video should resume)

// Get current time
console.log('Current time:', v.currentTime, 'seconds');
// Expected: Number representing current playback position

// Get duration
console.log('Duration:', v.duration, 'seconds');
// Expected: Number representing total video length
```

## 3. Seek Tests

```javascript
const v = window.testVideo || document.querySelector('video');

// Store initial position
const initialTime = v.currentTime;
console.log('Initial time:', initialTime);

// Seek backward 5 seconds
v.currentTime -= 5;
console.log('After -5s:', v.currentTime);
// Expected: initialTime - 5 (approximately)

// Wait a moment, then seek forward 5 seconds
setTimeout(() => {
  const beforeForward = v.currentTime;
  v.currentTime += 5;
  console.log('After +5s:', v.currentTime);
  // Expected: beforeForward + 5 (approximately)
}, 1000);

// Seek to specific time (e.g., 30 seconds)
setTimeout(() => {
  v.currentTime = 30;
  console.log('After seek to 30s:', v.currentTime);
  // Expected: ~30 (may take moment to update)
}, 2000);
```

## 4. Playback Speed Tests

```javascript
const v = window.testVideo || document.querySelector('video');

// Get current speed
console.log('Current playbackRate:', v.playbackRate);
// Expected: 1 (normal speed)

// Decrease speed to 0.9x
v.playbackRate = 0.9;
console.log('After 0.9x:', v.playbackRate);
// Expected: 0.9 (video should play 10% slower)

// Increase speed to 1.1x
setTimeout(() => {
  v.playbackRate = 1.1;
  console.log('After 1.1x:', v.playbackRate);
  // Expected: 1.1 (video should play 10% faster)
}, 2000);

// Reset to normal
setTimeout(() => {
  v.playbackRate = 1.0;
  console.log('Reset to 1.0x:', v.playbackRate);
  // Expected: 1.0
}, 4000);
```

## 5. Fullscreen Mode Tests

**Instructions:**
1. Enter fullscreen mode manually (click fullscreen button or press F)
2. Open devtools (F12 or Cmd+Option+I on Mac)
3. Re-run the Basic Controls and Seek Tests from sections 2 and 3
4. Verify all commands work the same way in fullscreen

```javascript
// Quick fullscreen test suite
const v = window.testVideo || document.querySelector('video');

console.log('=== FULLSCREEN TEST SUITE ===');

// Test pause/play
v.pause();
console.log('1. Paused:', v.paused);

v.play().then(() => {
  console.log('2. Playing:', !v.paused);
});

// Test seek
setTimeout(() => {
  const before = v.currentTime;
  v.currentTime += 5;
  setTimeout(() => {
    console.log('3. Seek +5s: before =', before, ', after =', v.currentTime);
  }, 100);
}, 1000);

// Test speed
setTimeout(() => {
  v.playbackRate = 1.1;
  console.log('4. Speed 1.1x:', v.playbackRate);
}, 2000);

console.log('=== Tests queued, watch for results ===');
```

## 6. Troubleshooting Section

### Video element not found

```javascript
// Check for iframes
const iframes = document.querySelectorAll('iframe');
console.log('Iframes found:', iframes.length);
iframes.forEach((iframe, i) => {
  console.log(`Iframe ${i}:`, iframe.src);
});

// Try accessing iframe content (will fail if cross-origin)
if (iframes.length > 0) {
  try {
    const v = iframes[0].contentDocument.querySelector('video');
    console.log('Video in iframe:', v);
  } catch (e) {
    console.error('Cross-origin iframe - cannot access:', e.message);
    console.warn('⚠️ BLOCKER: Cross-origin iframes prevent content script access');
  }
}
```

### Check for Shadow DOM

```javascript
// Find all elements with shadow roots
const allElements = document.querySelectorAll('*');
let shadowHosts = [];
allElements.forEach(el => {
  if (el.shadowRoot) {
    shadowHosts.push(el);
  }
});

console.log('Shadow DOM hosts found:', shadowHosts.length);
shadowHosts.forEach((host, i) => {
  const video = host.shadowRoot.querySelector('video');
  if (video) {
    console.log(`Video in shadow DOM ${i}:`, video);
  }
});
```

### Verify video element accessibility

```javascript
const v = window.testVideo || document.querySelector('video');

if (!v) {
  console.error('❌ No video element found');
} else {
  console.log('✓ Video element found');
  console.log('  Tag:', v.tagName);
  console.log('  Ready state:', v.readyState);
  console.log('  Network state:', v.networkState);
  console.log('  Can play?:', v.readyState >= 2);
  console.log('  Has source?:', v.src || v.querySelector('source')?.src);
}
```

## Notes

- All snippets assume standard HTMLMediaElement API
- If commands fail silently, check browser console for errors
- Some platforms override default behavior - note any quirks
- Cross-origin iframe restrictions are a hard blocker for content scripts
- Test in fresh page load, mid-playback, and after seeking to check for state-dependent behavior
