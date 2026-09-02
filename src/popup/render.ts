import { escapeHtml } from "../utils/dom";
import { t } from "../utils/i18n";
import { getDisplayName, isAnimeSite } from "../sites/registry";
import type { GenericDetectionResult, MediaType, PopupState } from "../types";
import { btnLogin, stateContainer } from "./elements";
import { requestRefresh } from "./state";
import { renderDetected } from "./views/detected";

type GenericPick = (candidate: GenericDetectionResult, mediaType: MediaType) => void;

let genericPickHandler: GenericPick = () => {};

export function setGenericPickHandler(handler: GenericPick): void {
  genericPickHandler = handler;
}

export function renderState(state: PopupState): void {
  stateContainer.innerHTML = "";

  switch (state.type) {
    case "loading":
      stateContainer.innerHTML = `
        <div class="state-box">
          <div class="spinner"></div>
          <p class="state-text">${escapeHtml(t("stateLoading"))}</p>
        </div>`;
      break;

    case "searching": {
      const preview = state.preview;
      const label = preview
        ? (preview.mediaType === "ANIME" ? t("episodeLabel", String(preview.progress)) : t("chapterLabel", String(preview.progress)))
        : "";
      stateContainer.innerHTML = `
        <div class="state-box">
          <div class="spinner"></div>
          ${preview ? `<p class="state-title">${escapeHtml(preview.title)}</p><p class="state-text">${escapeHtml(label)}</p>` : ""}
          <p class="state-hint" style="margin-top:8px">${escapeHtml(t("stateSearching"))}</p>
        </div>`;
      break;
    }

    case "unsupported_site":
      stateContainer.innerHTML = `
        <div class="state-box">
          <div class="state-icon">🌐</div>
          <p class="state-title">${escapeHtml(t("stateUnsupportedSite"))}</p>
          <p class="state-text"><strong>${escapeHtml(state.hostname)}</strong> ${escapeHtml(t("stateUnsupportedSiteText"))}</p>
          <p class="state-hint" style="margin-top:6px;opacity:0.7;font-size:12px">${escapeHtml(t("stateUnsupportedSiteHint"))}</p>
          <button class="btn btn-ghost" id="btn-retry-generic" style="margin-top:10px">${escapeHtml(t("retryDetection"))}</button>
        </div>`;
      document.getElementById("btn-retry-generic")!.addEventListener("click", requestRefresh);
      break;

    case "generic_type_pick":
      stateContainer.innerHTML = `
        <div class="state-box">
          <div class="state-icon">🤔</div>
          <p class="state-title">${escapeHtml(state.candidate.title)}</p>
          <p class="state-text">${escapeHtml(t("chapterLabel", String(state.candidate.progress)))}</p>
          <p class="state-hint" style="margin-bottom:10px">${escapeHtml(t("askMediaType"))}</p>
          <div style="display:flex;gap:8px">
            <button class="btn btn-primary" id="pick-manga">📖 ${escapeHtml(t("typeManga"))}</button>
            <button class="btn btn-primary" id="pick-anime">📺 ${escapeHtml(t("typeAnime"))}</button>
          </div>
        </div>`;
      document.getElementById("pick-manga")!.addEventListener("click", () =>
        genericPickHandler(state.candidate, "MANGA")
      );
      document.getElementById("pick-anime")!.addEventListener("click", () =>
        genericPickHandler(state.candidate, "ANIME")
      );
      break;

    case "unsupported_page": {
      const anime = isAnimeSite(state.site);
      stateContainer.innerHTML = `
        <div class="state-box">
          <div class="state-icon">${anime ? "📺" : "📖"}</div>
          <p class="state-title">${escapeHtml(anime ? t("stateNoEpisode") : t("stateNoChapter"))}</p>
          <p class="state-text">${escapeHtml(t("youAreOn"))} <strong>${escapeHtml(getDisplayName(state.site))}</strong>.</p>
          <p class="state-hint">${escapeHtml(anime ? t("stateNoEpisodeText") : t("stateNoChapterText"))}</p>
        </div>`;
      break;
    }

    case "detection_failed":
      stateContainer.innerHTML = `
        <div class="state-box">
          <div class="state-icon">⚠️</div>
          <p class="state-title">${escapeHtml(t("stateDetectionFailed"))}</p>
          <p class="state-text">${escapeHtml(t("stateDetectionFailedText"))}</p>
          <p class="state-hint">${escapeHtml(t("stateDetectionFailedHint"))} <a href="https://github.com/TheNesur/anilist-tracker/issues" target="_blank">${escapeHtml(t("reportBug"))}</a></p>
        </div>`;
      break;

    case "detected":
      renderDetected(state);
      break;

    case "token_expired": {
      stateContainer.innerHTML = `
        <div class="state-box">
          <div class="state-icon">🔒</div>
          <p class="state-title">${escapeHtml(t("errorTitle"))}</p>
          <p class="state-text">${escapeHtml(t("tokenExpired"))}</p>
        </div>`;
      const btn = document.createElement("button");
      btn.className = "btn btn-primary";
      btn.style.margin = "0 16px 16px";
      btn.textContent = t("btnLogin");
      btn.addEventListener("click", async () => {
        await chrome.storage.local.set({ tokenExpired: false });
        btnLogin.click();
      });
      stateContainer.appendChild(btn);
      break;
    }

    case "error":
      stateContainer.innerHTML = `
        <div class="state-box">
          <div class="state-icon">❌</div>
          <p class="state-title">${escapeHtml(t("errorTitle"))}</p>
          <p class="state-text">${escapeHtml(t("apiError"))}</p>
          <p class="state-hint"><a href="https://discord.gg/TF428cr" target="_blank">${escapeHtml(t("apiErrorHint"))}</a></p>
        </div>`;
      break;
  }
}
