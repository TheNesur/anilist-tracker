import { getParser } from "../parsers";
import type { MediaDetectedMessage } from "../types";

if (window.self !== window.top) {
  throw new Error("AniList Tracker: skipping iframe context");
}

const NAV_EVENT = "anilist-tracker:navigation";
const POLL_INTERVAL_MS = 100;
const POLL_MAX_ATTEMPTS = 100;

function detectAndNotify() {
  const parser = getParser();
  if (!parser) return;

  const detection = parser.detect();
  if (!detection) {
    chrome.storage.session.set({
      detectionFailed: true,
      lastDetectionUrl: window.location.href,
    });
    return;
  }

  chrome.storage.session.set({ detectionFailed: false });

  const message: MediaDetectedMessage = {
    type: "MEDIA_DETECTED",
    payload: detection,
  };

  chrome.runtime.sendMessage(message).catch(() => {});
}

function waitForParserReady() {
  const parser = getParser();
  if (!parser) return;

  let attempts = 0;
  const interval = window.setInterval(() => {
    attempts++;
    if (parser.isChapterPage()) {
      window.clearInterval(interval);
      detectAndNotify();
    } else if (attempts >= POLL_MAX_ATTEMPTS) {
      window.clearInterval(interval);
      chrome.storage.session.set({
        detectionFailed: true,
        lastDetectionUrl: window.location.href,
      });
    }
  }, POLL_INTERVAL_MS);
}

function runInitial() {
  if (document.readyState === "interactive" || document.readyState === "complete") {
    waitForParserReady();
  } else {
    document.addEventListener("readystatechange", () => {
      if (document.readyState === "interactive") waitForParserReady();
    }, { once: true });
  }
}

function hookHistoryNavigation() {
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

let lastUrl = window.location.href;

function onNavigation() {
  if (window.location.href === lastUrl) return;
  lastUrl = window.location.href;
  waitForParserReady();
}

hookHistoryNavigation();
window.addEventListener(NAV_EVENT, onNavigation);

window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    waitForParserReady();
  }
});

runInitial();