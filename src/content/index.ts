import { getParser } from "../parsers";
import type { MangaDetectedMessage } from "../types";

function main() {
  const parser = getParser();
  if (!parser) return;

  if (!parser.isChapterPage()) return;

  const detection = parser.detect();
  if (!detection) {
    console.log("[AniList Tracker] Could not detect media info on this page.");
    chrome.storage.session.set({ detectionFailed: true, lastDetectionUrl: window.location.href });
    return;
  }

  console.log("[AniList Tracker] Detected:", detection);
  chrome.storage.session.set({ detectionFailed: false });

  const message: MangaDetectedMessage = {
    type: "MANGA_DETECTED",
    payload: detection,
  };

  chrome.runtime.sendMessage(message);
}

function waitForTitleAndRun(expectedUrlChange: boolean, previousTitle: string) {
  const maxAttempts = 20;
  let attempts = 0;

  const interval = setInterval(() => {
    attempts++;
    const titleChanged = document.title !== previousTitle;
    const titleReady = document.title.length > 0 && document.title !== "MANGA Plus";

    if ((expectedUrlChange && titleChanged) || (!expectedUrlChange) || attempts >= maxAttempts) {
      clearInterval(interval);
      main();
    } else if (titleReady && !expectedUrlChange) {
      clearInterval(interval);
      main();
    }

    if (attempts >= maxAttempts) clearInterval(interval);
  }, 150);
}

// Initial load
setTimeout(main, 1500);

let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    const previousTitle = document.title;
    lastUrl = window.location.href;
    waitForTitleAndRun(true, previousTitle);
  }
});

observer.observe(document.body, { childList: true, subtree: true });