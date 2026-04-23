import { getParser } from "../parsers";
import type { MangaDetectedMessage } from "../types";

function main() {
  const parser = getParser();
  if (!parser) return;

  if (!parser.isChapterPage()) return;

  const detection = parser.detect();
  if (!detection) {
    console.log("[AniList Tracker] Could not detect manga info on this page.");
    return;
  }

  console.log("[AniList Tracker] Detected:", detection);

  const message: MangaDetectedMessage = {
    type: "MANGA_DETECTED",
    payload: detection,
  };

  chrome.runtime.sendMessage(message);
}

setTimeout(main, 1500);

let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    setTimeout(main, 1500);
  }
});

observer.observe(document.body, { childList: true, subtree: true });
