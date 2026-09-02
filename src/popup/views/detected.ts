import { escapeHtml } from "../../utils/dom";
import { t } from "../../utils/i18n";
import { saveTitleMapping } from "../../utils/storage";
import type { AniListMedia, MediaDetection, PopupState } from "../../types";
import { stateContainer } from "../elements";
import {
  getActiveTabId,
  getCurrentDetection,
  getSelectedMedia,
  readTabState,
  setCurrentDetection,
  setSelectedMedia,
  updateTabState,
} from "../state";
import { fetchProgress, reportAlias, requestUpdate, searchAniList, submitAlias } from "../messaging";
import { renderPendingQueue } from "./banners";
import { showManualSearch, showResults, type ResultsOptions } from "./results";

const resultsOptions: ResultsOptions = { onSelect: (media) => void selectMedia(media) };

export function renderDetected(state: Extract<PopupState, { type: "detected" }>): void {
  const { detection, progress, media, searchResults, isManualMatch } = state;

  setCurrentDetection(detection);
  setSelectedMedia(media);

  const isAnime = detection.mediaType === "ANIME";
  const progressLabel = isAnime
    ? t("episodeLabel", String(detection.progress))
    : t("chapterLabel", String(detection.progress));

  const displayTitle = escapeHtml(media?.title.english ?? media?.title.romaji ?? detection.title);

  const progressText = progress !== null
    ? `${escapeHtml(progressLabel)} <span class="progress-hint" id="progress-hint">(${progress})</span>`
    : escapeHtml(progressLabel);

  let sourceHostname: string;
  try { sourceHostname = new URL(detection.url).hostname; } catch { sourceHostname = detection.source; }

  stateContainer.innerHTML = `
    <div class="detection-card">
      <div class="media-title" id="media-title">${displayTitle}</div>
      <div class="media-progress">${progressText}</div>
      <div class="media-source">${escapeHtml(t("sourceLabel"))} : ${escapeHtml(detection.source)} · ${escapeHtml(sourceHostname)}</div>
    </div>
    <div id="results-section" style="display:none">
      <p class="results-label" id="results-label">${escapeHtml(isAnime ? t("selectAnime") : t("selectManga"))}</p>
      <ul class="results-list" id="results-list"></ul>
    </div>
    <div id="confirm-section" style="display:none">
      <button class="btn btn-success" id="btn-update" style="width:100%">${escapeHtml(t("updateBtn"))}</button>
    </div>`;

  if (media) {
    showConfirm(detection, progress, isManualMatch);
    makeCardClickable(media, isAnime);
    return;
  }

  if (searchResults !== null && searchResults.length === 0) {
    showManualSearch(detection, resultsOptions);
    return;
  }

  if (searchResults && searchResults.length > 0) {
    showResults(searchResults, detection, resultsOptions);
  }
}

function makeCardClickable(media: AniListMedia, isAnime: boolean): void {
  const card = stateContainer.querySelector(".detection-card") as HTMLElement;
  const url = `https://anilist.co/${isAnime ? "anime" : "manga"}/${media.id}`;
  card.style.cursor = "pointer";
  card.title = t("openOnAniList");
  card.addEventListener("click", () => chrome.tabs.create({ url }));
}

function showConfirm(detection: MediaDetection, progress: number | null, isManualMatch: boolean): void {
  const section = document.getElementById("confirm-section")!;
  const btn = document.getElementById("btn-update") as HTMLButtonElement;

  section.querySelectorAll(".btn-change, .btn-report").forEach((el) => el.remove());
  section.style.display = "block";

  if (progress !== null && detection.progress <= progress) {
    btn.textContent = t("alreadyUpToDate", String(progress));
    btn.classList.remove("btn-success");
    btn.classList.add("btn-ghost");
    btn.disabled = true;
  } else if (progress !== null) {
    btn.classList.remove("btn-ghost");
    btn.classList.add("btn-success");
    btn.disabled = false;
    btn.textContent = t("updateBtnProgress", String(progress), String(detection.progress));
  } else {
    btn.textContent = t("updateBtn");
  }

  section.appendChild(buildChangeButton(detection, section));

  const selected = getSelectedMedia();
  if (!isManualMatch && selected) {
    section.appendChild(buildReportButton(detection, selected));
  }

  btn.onclick = handleUpdateClick;
}

function buildChangeButton(detection: MediaDetection, section: HTMLElement): HTMLButtonElement {
  const changeBtn = document.createElement("button");
  changeBtn.className = "btn btn-ghost btn-change";
  changeBtn.style.marginTop = "6px";
  changeBtn.textContent = t("changeMapping");

  changeBtn.addEventListener("click", async () => {
    setSelectedMedia(null);
    section.style.display = "none";

    const resultsSection = document.getElementById("results-section")!;
    const resultsList = document.getElementById("results-list")!;
    resultsSection.style.display = "block";

    const tabState = await readTabState();
    const cached = tabState.searchResults;

    if (cached && cached.length > 0) {
      showResults(cached, detection, resultsOptions);
      return;
    }

    resultsList.innerHTML = "";
    const loadingLi = document.createElement("li");
    loadingLi.style.cssText = "padding:8px;color:var(--text-muted)";
    loadingLi.textContent = t("stateLoading");
    resultsList.appendChild(loadingLi);

    const response = await searchAniList(detection.title, detection.mediaType);

    if (response?.results && response.results.length > 0) {
      await updateTabState({ searchResults: response.results });
      showResults(response.results, detection, resultsOptions);
      return;
    }

    showManualSearch(detection, resultsOptions);
  });

  return changeBtn;
}

function buildReportButton(detection: MediaDetection, media: AniListMedia): HTMLButtonElement {
  const reportBtn = document.createElement("button");
  reportBtn.className = "btn-report";
  reportBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
      <line x1="4" y1="22" x2="4" y2="15"/>
    </svg>
    <span>${escapeHtml(t("reportMatch"))}</span>
  `;

  reportBtn.addEventListener("click", async () => {
    reportBtn.disabled = true;
    reportBtn.querySelector("span")!.textContent = t("stateLoading");

    const response = await reportAlias({
      alias: detection.title,
      mediaType: detection.mediaType,
      mediaId: media.id,
    });

    reportBtn.querySelector("span")!.textContent = response?.success
      ? t("reportSent")
      : t("reportFailed");

    if (!response?.success) {
      reportBtn.disabled = false;
    }
  });

  return reportBtn;
}

async function selectMedia(media: AniListMedia): Promise<void> {
  const detection = getCurrentDetection();
  setSelectedMedia(media);

  if (detection) {
    await saveTitleMapping(detection.title, detection.mediaType, media.id);

    let sourceHostname: string | null = null;
    try { sourceHostname = new URL(detection.url).hostname; } catch { sourceHostname = null; }

    submitAlias({
      alias: detection.title,
      mediaType: detection.mediaType,
      mediaId: media.id,
      mediaTitle: media.title.english ?? media.title.romaji,
      sourceHostname,
    });
  }

  const response = await fetchProgress(media.id);
  const progress = response?.progress ?? null;

  await updateTabState({
    confirmedMedia: media,
    confirmedMediaManual: true,
    currentProgress: progress,
  });

  const titleEl = document.getElementById("media-title");
  if (titleEl) titleEl.textContent = media.title.english ?? media.title.romaji;

  const progressHint = document.getElementById("progress-hint");
  if (progressHint && progress !== null) progressHint.textContent = `(${progress})`;

  if (detection) showConfirm(detection, progress, true);

  document.getElementById("results-section")!.style.display = "none";
  document.getElementById("confirm-section")!.style.display = "block";
}

async function handleUpdateClick(): Promise<void> {
  const media = getSelectedMedia();
  const detection = getCurrentDetection();
  if (!media || !detection) return;

  const btn = document.getElementById("btn-update") as HTMLButtonElement;
  btn.textContent = t("stateLoading");
  btn.disabled = true;

  const response = await requestUpdate(media.id, detection.progress, detection.mediaType, getActiveTabId());

  if (!response?.success) {
    btn.textContent = t("updateError");
    btn.disabled = false;
    return;
  }

  btn.classList.remove("btn-success");
  btn.classList.add("btn-ghost");

  if (response.queued) {
    btn.textContent = t("updateQueued");
    await renderPendingQueue();
    return;
  }

  if (response.skipped) {
    btn.textContent = t("alreadyUpToDate", String(response.current));
    return;
  }

  await updateTabState({ currentProgress: response.progress ?? detection.progress });
  btn.textContent = t("updatedSuccess", String(response.progress));
}
