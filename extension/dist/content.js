// extension/content.ts
console.log("[Pathoma Controller] Content script loaded");
var MIN_PLAYBACK_RATE = 0.1;
var MAX_PLAYBACK_RATE = 4;
var DEFAULT_SPEED_DELTA = 0.1;
function findVideo() {
  const video = document.querySelector("video");
  if (!video) {
    console.warn("[Pathoma Controller] No video element found on page");
  }
  return video;
}
function executeCommand(command) {
  const video = findVideo();
  if (!video) {
    return { success: false, error: "Video element not found" };
  }
  try {
    switch (command.type) {
      case "play":
        video.play();
        console.log("[Pathoma Controller] Playing video");
        break;
      case "pause":
        video.pause();
        console.log("[Pathoma Controller] Pausing video");
        break;
      case "seekForward": {
        const amount = command.amount ?? 0;
        const newTime = Math.min(video.currentTime + amount, video.duration || 0);
        video.currentTime = newTime;
        console.log(`[Pathoma Controller] Seeking forward ${amount}s to ${newTime.toFixed(1)}s`);
        break;
      }
      case "seekBackward": {
        const amount = command.amount ?? 0;
        const newTime = Math.max(video.currentTime - amount, 0);
        video.currentTime = newTime;
        console.log(`[Pathoma Controller] Seeking backward ${amount}s to ${newTime.toFixed(1)}s`);
        break;
      }
      case "speedUp": {
        const amount = command.amount ?? DEFAULT_SPEED_DELTA;
        const newRate = Math.min(video.playbackRate + amount, MAX_PLAYBACK_RATE);
        video.playbackRate = newRate;
        console.log(`[Pathoma Controller] Speed up to ${newRate.toFixed(2)}x`);
        break;
      }
      case "speedDown": {
        const amount = command.amount ?? DEFAULT_SPEED_DELTA;
        const newRate = Math.max(video.playbackRate - amount, MIN_PLAYBACK_RATE);
        video.playbackRate = newRate;
        console.log(`[Pathoma Controller] Speed down to ${newRate.toFixed(2)}x`);
        break;
      }
      default:
        return { success: false, error: `Unknown command type: ${command.type}` };
    }
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Pathoma Controller] Error executing command:", errorMessage);
    return { success: false, error: errorMessage };
  }
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[Pathoma Controller] Received command:", message.type, message.amount);
  const result = executeCommand(message);
  sendResponse(result);
  return true;
});
console.log("[Pathoma Controller] Content script ready, listening for commands");
