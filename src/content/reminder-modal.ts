import { escapeHtml } from "../utils/dom";
import type { AniListMedia, MediaDetection, UpdateResult } from "../types";

let currentDetection: MediaDetection | null = null;
let bannerInjectedForUrl: string | null = null;

export function injectInlineSyncBanner(detection: MediaDetection): void {
  currentDetection = detection;

  const existing = document.getElementById("anilist-tracker-inline-banner");
  if (bannerInjectedForUrl === window.location.href && existing) {
    return;
  }
  if (existing) existing.remove();

  const targetContainer =
    document.querySelector(".naveps.bignav") ??
    document.querySelector(".naveps") ??
    document.getElementById("pembed") ??
    document.querySelector(".player-embed") ??
    document.querySelector(".item.video-nav") ??
    document.querySelector("h1.entry-title, h1") ??
    document.querySelector(".infx");

  if (!targetContainer && !document.body) return;

  bannerInjectedForUrl = window.location.href;

  const banner = document.createElement("div");
  banner.id = "anilist-tracker-inline-banner";
  banner.style.cssText = `
    display: flex !important;
    visibility: visible !important;
    opacity: 1 !important;
    margin: 16px 0 !important;
    padding: 14px 20px !important;
    background: #0b1622 !important;
    border: 2px solid #3db4f2 !important;
    border-radius: 10px !important;
    color: #e0e6ed !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    align-items: center !important;
    justify-content: space-between !important;
    gap: 16px !important;
    box-shadow: 0 6px 20px rgba(0,0,0,0.6) !important;
    clear: both !important;
    position: relative !important;
    z-index: 2147483640 !important;
    box-sizing: border-box !important;
    width: 100% !important;
    max-width: 100% !important;
  `;

  banner.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
      <span style="font-size: 26px; flex-shrink: 0; line-height: 1;">📺</span>
      <div style="min-width: 0;">
        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; color: #3db4f2; font-weight: 700; margin-bottom: 2px;">
          AniList Tracker
        </div>
        <div style="font-size: 15px; font-weight: 600; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${escapeHtml(detection.title)} · Folge ${detection.progress}
        </div>
      </div>
    </div>
    <div style="display: flex; gap: 8px; flex-shrink: 0;">
      <button id="anilist-tracker-btn-open-modal" style="
        background: #3db4f2;
        color: #ffffff;
        border: none;
        padding: 9px 18px;
        border-radius: 6px;
        font-weight: 700;
        font-size: 13px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      ">
        ✓ Auf AniList speichern
      </button>
    </div>
  `;

  const btn = banner.querySelector("#anilist-tracker-btn-open-modal") as HTMLButtonElement;
  btn.addEventListener("click", () => {
    openInPageSyncModal(detection);
  });

  if (targetContainer) {
    if (targetContainer.classList.contains("naveps")) {
      targetContainer.parentNode?.insertBefore(banner, targetContainer.nextSibling);
    } else {
      targetContainer.parentNode?.insertBefore(banner, targetContainer);
    }
  } else {
    document.body.prepend(banner);
  }
}

export async function openInPageSyncModal(detection: MediaDetection): Promise<void> {
  const existing = document.getElementById("anilist-tracker-sync-modal");
  if (existing) existing.remove();

  const modalOverlay = document.createElement("div");
  modalOverlay.id = "anilist-tracker-sync-modal";
  modalOverlay.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    background: rgba(0, 0, 0, 0.75) !important;
    backdrop-filter: blur(4px) !important;
    z-index: 2147483647 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
  `;

  modalOverlay.innerHTML = `
    <div style="
      background: #0b1622;
      border: 1px solid #1f2d40;
      border-radius: 12px;
      width: 440px;
      max-width: 90vw;
      max-height: 85vh;
      overflow-y: auto;
      box-shadow: 0 16px 40px rgba(0,0,0,0.8);
      color: #e0e6ed;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    ">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1f2d40; padding-bottom: 12px;">
        <div style="font-weight: 700; font-size: 16px; color: #3db4f2; display: flex; align-items: center; gap: 8px;">
          <span>AniList Tracker</span>
          <span style="font-size: 11px; background: #151f2e; padding: 2px 6px; border-radius: 4px; color: #8a9aa9;">Bestätigung</span>
        </div>
        <button id="modal-close" style="background: transparent; border: none; color: #8a9aa9; font-size: 20px; cursor: pointer;">&times;</button>
      </div>

      <div id="modal-content" style="display: flex; flex-direction: column; gap: 14px;">
        <div style="display: flex; align-items: center; gap: 10px; padding: 12px; background: #151f2e; border-radius: 8px;">
          <div style="font-size: 24px;">⏳</div>
          <div style="font-size: 13px; color: #8a9aa9;">Lade Staffel- & Seriendaten von AniList...</div>
        </div>
      </div>
    </div>
  `;

  modalOverlay.querySelector("#modal-close")?.addEventListener("click", () => modalOverlay.remove());
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) modalOverlay.remove();
  });

  document.body.appendChild(modalOverlay);

  const content = modalOverlay.querySelector("#modal-content") as HTMLElement;

  try {
    const searchRes = await chrome.runtime.sendMessage({
      type: "SEARCH_ANILIST",
      payload: { title: detection.title, mediaType: detection.mediaType },
    });

    const results: AniListMedia[] = searchRes?.results ?? [];

    if (results.length === 0) {
      content.innerHTML = `
        <div style="padding: 12px; background: #151f2e; border-radius: 8px; font-size: 13px; color: #c5cae9;">
          Kein passender Eintrag auf AniList gefunden für: <strong>${escapeHtml(detection.title)}</strong>
        </div>
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <button id="modal-cancel-btn" style="background: #1a2738; color: #e0e6ed; border: none; padding: 8px 14px; border-radius: 6px; cursor: pointer;">Schließen</button>
        </div>
      `;
      content.querySelector("#modal-cancel-btn")?.addEventListener("click", () => modalOverlay.remove());
      return;
    }

    renderSelectionModal(content, results, detection, modalOverlay);
  } catch (err) {
    content.innerHTML = `
      <div style="padding: 12px; background: rgba(231,76,60,0.15); border: 1px solid #e74c3c; border-radius: 8px; color: #ff7675; font-size: 13px;">
        Fehler beim Abrufen von AniList: ${escapeHtml(String(err))}
      </div>
    `;
  }
}

async function renderSelectionModal(
  container: HTMLElement,
  results: AniListMedia[],
  detection: MediaDetection,
  modalOverlay: HTMLElement
): Promise<void> {
  let selected = results[0];

  const firstProgress = await chrome.runtime.sendMessage({
    type: "GET_PROGRESS",
    payload: {
      mediaId: selected.id,
      rawProgress: detection.progress,
      detectedTitle: detection.title,
      mediaType: detection.mediaType,
    },
  });

  let effectiveMedia = firstProgress?.resolvedMedia ?? selected;
  let effectiveProgress = firstProgress?.resolvedProgress ?? detection.progress;
  let currentProgress = firstProgress?.progress ?? null;

  function renderView() {
    const coverSrc = effectiveMedia.coverImage?.medium ?? "";
    container.innerHTML = `
      <div style="display: flex; gap: 14px; background: #151f2e; padding: 14px; border-radius: 8px; border: 1px solid #1f2d40;">
        ${coverSrc ? `<img src="${coverSrc}" style="width: 55px; height: 75px; object-fit: cover; border-radius: 4px; flex-shrink: 0;" />` : ""}
        <div style="display: flex; flex-direction: column; justify-content: center; gap: 4px; flex: 1; min-width: 0;">
          <div style="font-weight: 600; font-size: 14px; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${escapeHtml(effectiveMedia.title.english ?? effectiveMedia.title.romaji)}
          </div>
          <div style="font-size: 12px; color: #8a9aa9;">
            ${escapeHtml(effectiveMedia.title.romaji)}
          </div>
          <div style="font-size: 12px; color: #3db4f2; margin-top: 2px;">
            Aktualisierung: <strong>Folge ${effectiveProgress}</strong>
            ${currentProgress !== null ? `<span style="color: #8a9aa9;">(aktuell auf AniList: ${currentProgress})</span>` : ""}
          </div>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 6px;">
        <div style="font-size: 12px; font-weight: 600; color: #8a9aa9; text-transform: uppercase;">Gefundene Staffeln / Treffer:</div>
        <div style="max-height: 160px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;">
          ${results
            .map(
              (r) => `
            <div class="result-choice" data-id="${r.id}" style="
              display: flex;
              align-items: center;
              gap: 10px;
              padding: 8px 10px;
              border-radius: 6px;
              background: ${r.id === effectiveMedia.id ? "#1f2d40" : "#101a26"};
              border: 1px solid ${r.id === effectiveMedia.id ? "#3db4f2" : "#1a2738"};
              cursor: pointer;
            ">
              <span style="font-size: 13px; font-weight: 500; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${escapeHtml(r.title.english ?? r.title.romaji)}
              </span>
              <span style="font-size: 11px; color: #8a9aa9;">${r.episodes ? `${r.episodes} Eps` : ""}</span>
            </div>
          `
            )
            .join("")}
        </div>
      </div>

      <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 8px;">
        <button id="modal-abort-btn" style="
          background: #151f2e;
          color: #c5cae9;
          border: 1px solid #1f2d40;
          padding: 8px 14px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
        ">Abbrechen</button>
        <button id="modal-confirm-btn" style="
          background: #2ecc71;
          color: #ffffff;
          border: none;
          padding: 8px 18px;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          font-size: 13px;
        ">✓ Auf AniList speichern</button>
      </div>
    `;

    container.querySelectorAll(".result-choice").forEach((el) => {
      el.addEventListener("click", async () => {
        const id = Number(el.getAttribute("data-id"));
        const chosen = results.find((r) => r.id === id);
        if (chosen) {
          selected = chosen;
          const prog = await chrome.runtime.sendMessage({
            type: "GET_PROGRESS",
            payload: {
              mediaId: chosen.id,
              rawProgress: detection.progress,
              detectedTitle: detection.title,
              mediaType: detection.mediaType,
            },
          });
          effectiveMedia = prog?.resolvedMedia ?? chosen;
          effectiveProgress = prog?.resolvedProgress ?? detection.progress;
          currentProgress = prog?.progress ?? null;
          renderView();
        }
      });
    });

    container.querySelector("#modal-abort-btn")?.addEventListener("click", () => modalOverlay.remove());

    const confirmBtn = container.querySelector("#modal-confirm-btn") as HTMLButtonElement;
    confirmBtn?.addEventListener("click", async () => {
      confirmBtn.disabled = true;
      confirmBtn.textContent = "Speichere...";

      const res: UpdateResult | null = await chrome.runtime.sendMessage({
        type: "UPDATE_PROGRESS",
        payload: {
          mediaId: effectiveMedia.id,
          progress: effectiveProgress,
          mediaType: detection.mediaType,
        },
      });

      if (res?.success) {
        confirmBtn.style.background = "#27ae60";
        confirmBtn.textContent = `✓ Gespeichert (Folge ${effectiveProgress})`;
        const inlineBtn = document.getElementById("anilist-tracker-btn-open-modal");
        if (inlineBtn) {
          inlineBtn.textContent = `✓ Gespeichert (Folge ${effectiveProgress})`;
          (inlineBtn as HTMLButtonElement).style.background = "#27ae60";
        }
        setTimeout(() => modalOverlay.remove(), 1200);
      } else {
        confirmBtn.disabled = false;
        confirmBtn.style.background = "#e74c3c";
        confirmBtn.textContent = "Fehler beim Speichern";
      }
    });
  }

  renderView();
}
