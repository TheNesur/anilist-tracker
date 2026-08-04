import { getCatalogParser } from "../parsers/catalog";
import { getStorage, getTitleMapping } from "../utils/storage";
import type { CatalogEntry } from "../types";

if (window.self !== window.top) {
  throw new Error("AniList Tracker: skipping iframe context");
}

const BADGE_CLASS = "anilist-tracker-catalog-badge";
const CARD_CLASS = "anilist-tracker-catalog-card";
const STYLE_ID = "anilist-tracker-catalog-style";

type CatalogStatus = "uptodate" | "behind" | "notstarted" | "unmapped";

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .${CARD_CLASS} {
      outline: 3px solid transparent;
      outline-offset: 2px;
      border-radius: 6px;
      transition: outline-color 0.2s;
    }
    .${CARD_CLASS}[data-anilist-status="uptodate"] { outline-color: #2ecc71; }
    .${CARD_CLASS}[data-anilist-status="behind"] { outline-color: #f39c12; }
    .${CARD_CLASS}[data-anilist-status="notstarted"] { outline-color: #e74c3c; }
    .${CARD_CLASS}[data-anilist-status="unmapped"] { outline-color: #6b7c93; outline-style: dashed; }
    .${BADGE_CLASS} {
      display: block;
      font-size: 11px;
      font-weight: 600;
      text-align: center;
      padding: 2px 4px;
      margin-top: 2px;
      border-radius: 4px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .${BADGE_CLASS}[data-status="uptodate"] { background: rgba(46, 204, 113, 0.15); color: #2ecc71; }
    .${BADGE_CLASS}[data-status="behind"] { background: rgba(243, 156, 18, 0.15); color: #f39c12; }
    .${BADGE_CLASS}[data-status="notstarted"] { background: rgba(231, 76, 60, 0.15); color: #e74c3c; }
    .${BADGE_CLASS}[data-status="unmapped"] { background: rgba(107, 124, 147, 0.15); color: #9aa7b8; cursor: pointer; }
  `;
  document.head.appendChild(style);
}

function applyBadge(entry: CatalogEntry, status: CatalogStatus, label: string) {
  entry.element.classList.add(CARD_CLASS);
  entry.element.setAttribute("data-anilist-status", status);

  const existing = entry.element.querySelector(`.${BADGE_CLASS}`);
  if (existing) existing.remove();

  const badge = document.createElement("div");
  badge.className = BADGE_CLASS;
  badge.setAttribute("data-status", status);
  badge.textContent = label;

  if (status === "unmapped") {
    badge.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.open(entry.url, "_blank");
    });
  }

  const info = entry.element.querySelector(".info") ?? entry.element;
  info.appendChild(badge);
}

async function runCatalogOverlay() {
  const parser = getCatalogParser();
  if (!parser || !parser.isCatalogPage()) return;

  const storage = await getStorage();
  if (!storage.showCatalogStatus || !storage.accessToken) return;

  const entries = parser.detectEntries();
  if (entries.length === 0) return;

  injectStyles();

  const response = await chrome.runtime
    .sendMessage({ type: "GET_PROGRESS_CACHE", payload: { mediaType: "MANGA" } })
    .catch(() => null);
  const progressCache: Record<number, number> = response?.cache ?? {};

  for (const entry of entries) {
    const mediaId = await getTitleMapping(entry.title);

    if (!mediaId) {
      applyBadge(entry, "unmapped", "Non mappé");
      continue;
    }

    const progress = progressCache[mediaId];

    if (progress === undefined) {
      applyBadge(entry, "notstarted", "Pas commencé");
    } else if (progress < entry.latestChapter) {
      const diff = entry.latestChapter - progress;
      applyBadge(entry, "behind", `En retard de ${diff} ch.`);
    } else {
      applyBadge(entry, "uptodate", "À jour");
    }
  }
}

function scheduleRun() {
  runCatalogOverlay().catch(() => {});
}

function setupObserver() {
  const container = document.querySelector("#recently-up-ajax");
  if (!container) return;

  const observer = new MutationObserver(() => {
    scheduleRun();
  });
  observer.observe(container, { childList: true, subtree: false });
}

function init() {
  scheduleRun();
  setupObserver();
}

if (document.readyState === "interactive" || document.readyState === "complete") {
  init();
} else {
  document.addEventListener("readystatechange", () => {
    if (document.readyState === "interactive") init();
  }, { once: true });
}