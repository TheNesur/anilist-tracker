import { getParser } from "../parsers";
import type { MangaDetectedMessage } from "../types";

/**
 * Content script - runs on supported manga reading sites.
 * Detects the current manga + chapter and notifies the background worker.
 */
function main() {
  const parser = getParser();
  if (!parser) return;

  // Only run on actual chapter pages
  if (!parser.isChapterPage()) return;

  const detection = parser.detect();
  if (!detection) {
    console.log("[AniList Tracker] Could not detect manga info on this page.");
    return;
  }

  console.log("[AniList Tracker] Detected:", detection);

  // Send detection to background service worker
  const message: MangaDetectedMessage = {
    type: "MANGA_DETECTED",
    payload: detection,
  };

  chrome.runtime.sendMessage(message);
}

// Run after a short delay to let SPA pages finish rendering
setTimeout(main, 1500);

// Also listen for URL changes (SPA navigation)
let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    setTimeout(main, 1500);
  }
});

observer.observe(document.body, { childList: true, subtree: true });
