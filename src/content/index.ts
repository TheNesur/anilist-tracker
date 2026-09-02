import { getParser, type SiteParser } from "../parsers";

if (window.self !== window.top) {
  throw new Error("AniList Tracker: skipping iframe context");
}

const NAV_EVENT = "anilist-tracker:navigation";
const POLL_INTERVAL_MS = 150;
const POLL_TIMEOUT_MS = 8_000;

let pollTimer: number | null = null;
let lastUrl = window.location.href;
let lastNotified: string | null = null;
let pendingWhileHidden = false;

function stopPolling(): void {
  if (pollTimer === null) return;
  window.clearInterval(pollTimer);
  pollTimer = null;
}

function notifyFailure(): void {
  chrome.runtime
    .sendMessage({ type: "DETECTION_FAILED", url: window.location.href })
    .catch(() => {});
}

function detectAndNotify(parser: SiteParser): void {
  const detection = parser.detect();

  if (!detection) {
    notifyFailure();
    return;
  }

  const signature = `${detection.url}|${detection.mediaType}|${detection.progress}`;
  if (signature === lastNotified) return;
  lastNotified = signature;

  chrome.runtime
    .sendMessage({ type: "MEDIA_DETECTED", payload: detection })
    .catch(() => {});
}

function startPolling(): void {
  const parser = getParser();
  if (!parser) return;

  stopPolling();

  if (document.hidden) {
    pendingWhileHidden = true;
    return;
  }

  if (parser.isChapterPage()) {
    detectAndNotify(parser);
    return;
  }

  const deadline = Date.now() + POLL_TIMEOUT_MS;

  pollTimer = window.setInterval(() => {
    if (parser.isChapterPage()) {
      stopPolling();
      detectAndNotify(parser);
      return;
    }
    if (Date.now() >= deadline) {
      stopPolling();
      notifyFailure();
    }
  }, POLL_INTERVAL_MS);
}

function hookHistoryNavigation(): void {
  const origPush = history.pushState;
  const origReplace = history.replaceState;

  history.pushState = function (...args) {
    const result = origPush.apply(this, args);
    window.dispatchEvent(new Event(NAV_EVENT));
    return result;
  };

  history.replaceState = function (...args) {
    const result = origReplace.apply(this, args);
    window.dispatchEvent(new Event(NAV_EVENT));
    return result;
  };

  window.addEventListener("popstate", () => {
    window.dispatchEvent(new Event(NAV_EVENT));
  });
}

function onNavigation(): void {
  if (window.location.href === lastUrl) return;
  lastUrl = window.location.href;
  lastNotified = null;
  startPolling();
}

function runInitial(): void {
  if (document.readyState === "interactive" || document.readyState === "complete") {
    startPolling();
    return;
  }

  document.addEventListener(
    "readystatechange",
    () => {
      if (document.readyState === "interactive") startPolling();
    },
    { once: true }
  );
}

hookHistoryNavigation();
window.addEventListener(NAV_EVENT, onNavigation);

window.addEventListener("visibilitychange", () => {
  if (document.hidden || !pendingWhileHidden) return;
  pendingWhileHidden = false;
  startPolling();
});

window.addEventListener("pagehide", stopPolling);

window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    lastNotified = null;
    startPolling();
  }
});

runInitial();
