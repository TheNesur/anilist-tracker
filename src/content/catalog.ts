import { getCatalogParser } from "../parsers/catalog";
import { mappingKey } from "../utils/storage";
import { t } from "../utils/i18n";
import type { CatalogEntry } from "../types";

if (window.self !== window.top) {
  throw new Error("AniList Tracker: skipping iframe context");
}

const BADGE_CLASS = "anilist-tracker-catalog-badge";
const CARD_CLASS = "anilist-tracker-catalog-card";
const STYLE_ID = "anilist-tracker-catalog-style";
const RERUN_DEBOUNCE_MS = 250;

type CatalogStatus = "uptodate" | "behind" | "notstarted" | "unmapped";

let running = false;
let rerunRequested = false;
let debounceTimer: number | null = null;

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .${CARD_CLASS} {
      outline: 3px solid transparent;
      outline-offset: -3px;
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

function applyBadge(entry: CatalogEntry, status: CatalogStatus, label: string): void {
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

async function runCatalogOverlay(): Promise<void> {
  const parser = getCatalogParser();
  if (!parser || !parser.isCatalogPage()) return;

  const settings = await chrome.storage.local.get({ showCatalogStatus: false });
  if (!settings.showCatalogStatus) return;

  const entries = parser.detectEntries();
  if (entries.length === 0) return;

  const response = await chrome.runtime
    .sendMessage({ type: "GET_PROGRESS_CACHE", payload: { mediaType: "MANGA" } })
    .catch(() => null);

  if (!response?.authed) return;

  injectStyles();

  const progressCache: Record<number, number> = response.cache ?? {};
  const mappings = await chrome.storage.local.get({ titleMappings: {}, legacyTitleMappings: {} });
  const scoped = mappings.titleMappings as Record<string, number>;
  const legacy = mappings.legacyTitleMappings as Record<string, number>;

  for (const entry of entries) {
    const mediaId = scoped[mappingKey(entry.title, "MANGA")] ?? legacy[entry.title] ?? null;

    if (mediaId === null) {
      applyBadge(entry, "unmapped", t("catalogUnmapped"));
      continue;
    }

    const progress = progressCache[mediaId];

    if (progress === undefined) {
      applyBadge(entry, "notstarted", t("catalogNotStarted"));
    } else if (progress < entry.latestChapter) {
      const diff = entry.latestChapter - progress;
      applyBadge(entry, "behind", t("catalogBehind", String(diff)));
    } else {
      applyBadge(entry, "uptodate", t("catalogUpToDate"));
    }
  }
}

async function execute(): Promise<void> {
  if (running) {
    rerunRequested = true;
    return;
  }

  running = true;
  try {
    do {
      rerunRequested = false;
      await runCatalogOverlay();
    } while (rerunRequested);
  } catch {
    rerunRequested = false;
  } finally {
    running = false;
  }
}

function scheduleRun(): void {
  if (debounceTimer !== null) window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    debounceTimer = null;
    execute();
  }, RERUN_DEBOUNCE_MS);
}

function setupObserver(): void {
  const container = document.querySelector("#recently-up-ajax");
  if (!container) return;

  const observer = new MutationObserver(scheduleRun);
  observer.observe(container, { childList: true, subtree: false });
}

function init(): void {
  execute();
  setupObserver();
}

if (document.readyState === "interactive" || document.readyState === "complete") {
  init();
} else {
  document.addEventListener("readystatechange", () => {
    if (document.readyState === "interactive") init();
  }, { once: true });
}
