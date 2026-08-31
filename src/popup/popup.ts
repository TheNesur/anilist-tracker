import { getStorage, setTheme, getTheme, getToken } from "../utils/storage";
import { escapeHtml } from "../utils/dom";
import { getSiteForHostname, getDisplayName, isAnimeSite } from "../sites/registry";
import type { AniListMedia, MediaDetection, PopupState, SupportedSite, GenericDetectionResult, MediaType } from "../types";
import type { TabDetectionState } from "../background/tab-state";
import { t } from "../utils/i18n";

const loginView = document.getElementById("login-view")!;
const mainView = document.getElementById("main-view")!;
const btnLogin = document.getElementById("btn-login")!;
const usernameEl = document.getElementById("username")!;
const stateContainer = document.getElementById("state-container")!;
const btnSettings = document.getElementById("btn-settings")!;

let currentDetection: MediaDetection | null = null;
let selectedMedia: AniListMedia | null = null;
let activeTabId: number | null = null;

async function readTabState(): Promise<Partial<TabDetectionState>> {
  if (!activeTabId) return {};
  const key = `tab_${activeTabId}`;
  const result = await chrome.storage.session.get(key);
  return (result[key] as Partial<TabDetectionState>) ?? {};
}

async function updateTabState(partial: Partial<TabDetectionState>): Promise<void> {
  if (!activeTabId) return;
  const key = `tab_${activeTabId}`;
  const current = await readTabState();
  await chrome.storage.session.set({ [key]: { ...current, ...partial } });
}

async function init() {
  const storage = await getStorage();
  const token = await getToken();
  const theme = await getTheme();
  applyTheme(theme);

  document.getElementById("login-description")!.textContent = t("loginDescription");
  document.getElementById("btn-login")!.textContent = t("btnLogin");

  if (!token) {
    showView("login");
    return;
  }

  showView("main");
  usernameEl.textContent = storage.username ?? (storage.userId ? `#${storage.userId}` : "—");
  await resolveState();
  await renderPendingQueue();
  await renderPendingErrors();

  chrome.storage.session.onChanged.addListener((changes) => {
    const tabStateKey = activeTabId ? `tab_${activeTabId}` : null;
    if ((tabStateKey && changes[tabStateKey]) || changes.tokenExpired) {
      resolveState();
    }
  });

  chrome.storage.local.onChanged.addListener((changes) => {
    if (changes.pendingUpdates) {
      renderPendingQueue();
    }
  });

  document.getElementById("footer-anilist")!.textContent = t("openAniList");
}

async function renderPendingQueue() {
  const storage = await getStorage();
  const banner = document.getElementById("pending-queue")!;
  const label = document.getElementById("pending-queue-label")!;
  const btn = document.getElementById("btn-retry-now") as HTMLButtonElement;

  if (storage.pendingUpdates.length === 0) {
    banner.style.display = "none";
    return;
  }

  banner.style.display = "flex";
  label.textContent = t("pendingQueueLabel", String(storage.pendingUpdates.length));
  btn.textContent = t("retryNow");
  btn.disabled = false;

  btn.onclick = async () => {
    btn.disabled = true;
    btn.textContent = t("stateLoading");
    await chrome.runtime.sendMessage({ type: "FLUSH_PENDING_UPDATES" });
    await renderPendingQueue();
  };
}

async function renderPendingErrors() {
  const session = await chrome.storage.session.get("pendingUpdateErrorCount");
  const count = session.pendingUpdateErrorCount as number | undefined;
  if (!count) return;

  const banner = document.getElementById("pending-errors")!;
  const label = document.getElementById("pending-errors-label")!;
  banner.style.display = "flex";
  label.textContent = t("pendingUpdateErrors", String(count));

  await chrome.storage.session.remove("pendingUpdateErrorCount");
}

function applyTheme(theme: "dark" | "light") {
  document.documentElement.setAttribute("data-theme", theme);
}

async function tryGenericDetection(tabId: number): Promise<GenericDetectionResult | null> {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        function extractChapterNumber(text: string): number | null {
          const match = text.match(/(?:chapter|chapitre|ch\.?|ep\.?|episode|épisode)\s*([\d]+(?:\.[\d]+)?)/i);
          if (match) return parseFloat(match[1]);
          const numbers = text.match(/(\d+(?:\.\d+)?)/g);
          if (!numbers || numbers.length === 0) return null;
          const filtered = numbers.filter((n) => {
            if (/^(?:19|20)\d{2}$/.test(n)) return false;
            const idx = text.indexOf(n);
            if (idx > 0 && /v$/i.test(text.slice(Math.max(0, idx - 1), idx))) return false;
            return true;
          });
          if (filtered.length === 0) return null;
          return parseFloat(filtered[filtered.length - 1]);
        }

        const TYPE_WORDS = "manga|manhwa|manhua|webtoon|comic";
        function cleanTitle(raw: string): string {
          const cleaned = raw
            .replace(new RegExp(`^\\s*(${TYPE_WORDS})\\s+`, "i"), "")
            .replace(new RegExp(`\\s+(${TYPE_WORDS})\\s*$`, "i"), "")
            .replace(/\s+/g, " ")
            .trim();
          return cleaned || raw.trim();
        }

        const VIDEO_URL_HINTS = /episode|watch|player|streaming/i;
        const MANGA_URL_HINTS = /chapter|chapitre|read|scan|manga|manhwa|webtoon/i;

        function detectMediaTypeSignals() {
          const hasVideo = !!document.querySelector("video");
          const hasPlayerClass = !!document.querySelector("[class*='player' i], [id*='player' i]");
          const stackedImages = Array.from(document.querySelectorAll("img")).filter((img) => {
            const rect = img.getBoundingClientRect();
            return rect.height > rect.width * 1.3 && rect.height > 300;
          });
          return {
            anime: hasVideo || hasPlayerClass || VIDEO_URL_HINTS.test(window.location.href),
            manga: stackedImages.length >= 5 || MANGA_URL_HINTS.test(window.location.href),
          };
        }

        function stripSiteSuffix(title: string): string {
          const [first] = title.split(/\s+[-|·–—]\s+/);
          return first?.trim() || title;
        }

        function stripScanlationSuffix(raw: string): string {
          return raw
            .replace(/\s*\((vf|vostfr|vostf|vo|raw|fr|en|es|de|jp|kr|cn|pt|it|ru|ar|tr)\)\s*$/i, "")
            .replace(/\s*\[(vf|vostfr|vostf|vo|raw|fr|en|es|de|jp|kr|cn|pt|it|ru|ar|tr|scan\s*vf|scan\s*fr)\]\s*$/i, "")
            .replace(/\s*[-–—:|]\s*(scan\s*)?(vf|vostfr|vostf|vo|raw|fr)\b.*$/i, "")
            .replace(/\s*[-–—:|]\s*(english|french|français|spanish|español|german|deutsch|japanese|korean|chinese|portuguese|italian|indonesian|thai|arabic|turkish|russian)\s*$/i, "")
            .replace(/\s+scan\s*(vf|vostfr|vostf|vo|fr)\s*.*$/i, "")
            .replace(/\s+(vf|vostfr|vostf)\s*$/i, "")
            .replace(/\s*\((scan|scanlation|traduction|translation|trad|fantrad|fan\s*trad)\b[^()]*\)\s*$/i, "")
            .trim();
        }

        function extractTitle(): string | null {
          const ogTitle = document.querySelector<HTMLMetaElement>("meta[property='og:title']")?.content?.trim();
          const twitterTitle = document.querySelector<HTMLMetaElement>("meta[name='twitter:title']")?.content?.trim();
          const h1 = document.querySelector("h1")?.textContent?.trim();
          const docTitle = document.title.trim() || null;
          const candidate = ogTitle || twitterTitle || h1 || docTitle;
          return candidate ? cleanTitle(stripScanlationSuffix(stripSiteSuffix(candidate))) : null;
        }

        function extractProgress(title: string): number | null {
          const fromTitle = extractChapterNumber(title);
          if (fromTitle) return fromTitle;
          const fromDocTitle = extractChapterNumber(document.title);
          if (fromDocTitle) return fromDocTitle;
          const urlNumbers = window.location.pathname.match(/(\d+(?:\.\d+)?)/g);
          if (urlNumbers && urlNumbers.length > 0) {
            return parseFloat(urlNumbers[urlNumbers.length - 1]);
          }
          return null;
        }

        const rawTitle = extractTitle();
        if (!rawTitle) return null;

        const progress = extractProgress(rawTitle);
        if (progress === null || isNaN(progress)) return null;

        const signals = detectMediaTypeSignals();
        const possibleTypes: ("MANGA" | "ANIME")[] = [];
        if (signals.anime) possibleTypes.push("ANIME");
        if (signals.manga) possibleTypes.push("MANGA");
        if (possibleTypes.length === 0) possibleTypes.push("MANGA", "ANIME");

        return {
          title: rawTitle,
          progress: Math.floor(progress),
          url: window.location.href,
          possibleTypes,
        };
      },
    });
    return (result?.result as GenericDetectionResult | null) ?? null;
  } catch {
    return null;
  }
}

async function proceedWithGenericDetection(candidate: GenericDetectionResult, mediaType: MediaType) {
  const detection: MediaDetection = {
    title: candidate.title,
    progress: candidate.progress,
    mediaType,
    source: "generic",
    url: candidate.url,
  };
  renderState({ type: "loading" });
  chrome.runtime.sendMessage({ type: "MEDIA_DETECTED", payload: detection, tabId: activeTabId }).catch(() => {});
}

async function resolveState() {
  renderState({ type: "loading" });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url;
  activeTabId = tab?.id ?? null;

  if (!url || url.startsWith("chrome://") || url.startsWith("edge://") || url.startsWith("about:")) {
    renderState({ type: "unsupported_site", hostname: "system page" });
    return;
  }

  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    renderState({ type: "unsupported_site", hostname: "unknown" });
    return;
  }

  const siteInfo = getSiteForHostname(hostname);
  const site = siteInfo?.id ?? null;

  const tabState = await readTabState();
  const globalSession = await chrome.storage.session.get(["tokenExpired"]) as { tokenExpired?: boolean };

  const session = {
    ...tabState,
    tokenExpired: globalSession.tokenExpired ?? false,
  };

  if (session.tokenExpired) {
    renderState({ type: "error", message: t("tokenExpired") });
    const btn = document.createElement("button");
    btn.className = "btn btn-primary";
    btn.style.margin = "0 16px 16px";
    btn.textContent = t("btnLogin");
    btn.addEventListener("click", async () => {
      await chrome.storage.session.remove("tokenExpired");
      btnLogin.click();
    });
    stateContainer.appendChild(btn);
    return;
  }

  const lastUrl = session.lastDetectionUrl ?? null;
  const isCurrentPage = lastUrl && lastUrl === url;
  const isManualMatch = Boolean(session.confirmedMediaManual);

  if (session.apiError && isCurrentPage) {
    renderState({ type: "error", message: session.apiError });
    return;
  }

  if (session.detectionSearching && isCurrentPage) {
    renderState({
      type: "searching",
      preview: session.detectionSearchingPreview ?? null,
    });
    return;
  }

  if (!site) {
    if (session.lastDetection && isCurrentPage) {
      currentDetection = session.lastDetection;
      selectedMedia = session.confirmedMedia ?? null;
      renderState({
        type: "detected",
        detection: currentDetection,
        progress: session.currentProgress ?? null,
        media: selectedMedia,
        searchResults: selectedMedia ? null : (session.searchResults ?? null),
        isManualMatch,
      });
      return;
    }

    const candidate = tab?.id ? await tryGenericDetection(tab.id) : null;

    if (candidate) {
      if (candidate.possibleTypes.length === 1) {
        await proceedWithGenericDetection(candidate, candidate.possibleTypes[0]);
        return;
      }
      renderState({ type: "generic_type_pick", candidate, hostname });
      return;
    }

    renderState({ type: "unsupported_site", hostname });
    return;
  }

  if (session.detectionFailed && isCurrentPage) {
    renderState({ type: "detection_failed", site });
    return;
  }

  if (!session.lastDetection || !isCurrentPage) {
    renderState({ type: "unsupported_page", site });
    return;
  }

  currentDetection = session.lastDetection!;
  selectedMedia = session.confirmedMedia ?? null;

  renderState({
    type: "detected",
    detection: currentDetection,
    progress: session.currentProgress ?? null,
    media: selectedMedia,
    searchResults: selectedMedia ? null : (session.searchResults ?? null),
    isManualMatch,
  });
}

function renderState(state: PopupState) {
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
      document.getElementById("btn-retry-generic")!.addEventListener("click", resolveState);
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
        proceedWithGenericDetection(state.candidate, "MANGA")
      );
      document.getElementById("pick-anime")!.addEventListener("click", () =>
        proceedWithGenericDetection(state.candidate, "ANIME")
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

function renderDetected(state: Extract<PopupState, { type: "detected" }>) {
  const { detection, progress, media, searchResults, isManualMatch } = state;

  const isAnime = detection.mediaType === "ANIME";
  const progressLabel = isAnime
    ? t("episodeLabel", String(detection.progress))
    : t("chapterLabel", String(detection.progress));

  const displayTitle = escapeHtml(media?.title.english ?? media?.title.romaji ?? detection.title);

  const progressText = progress !== null
    ? `${escapeHtml(progressLabel)} <span class="progress-hint" id="progress-hint">(${progress})</span>`
    : escapeHtml(progressLabel);

  const sourceHostname = (() => {
    try { return new URL(detection.url).hostname; } catch { return detection.source; }
  })();

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
  } else if (searchResults !== null && searchResults.length === 0) {
    showManualSearch(detection);
  } else if (searchResults && searchResults.length > 0) {
    showResults(searchResults, detection);
  }

  if (media) {
    const card = stateContainer.querySelector(".detection-card") as HTMLElement;
    const url = `https://anilist.co/${detection.mediaType === "ANIME" ? "anime" : "manga"}/${media.id}`;
    card.style.cursor = "pointer";
    card.title = "Ouvrir sur AniList";
    card.addEventListener("click", () => chrome.tabs.create({ url }));
  }
}

function showManualSearch(detection: MediaDetection) {
  const section = document.getElementById("results-section")!;
  const label = document.getElementById("results-label")!;
  const list = document.getElementById("results-list")!;

  label.textContent = t("noResultsFound");
  section.style.display = "block";

  const li = document.createElement("li");
  li.style.cssText = "padding:4px 0 10px;display:block";

  const hint = document.createElement("p");
  hint.className = "state-hint";
  hint.style.marginBottom = "8px";
  hint.textContent = t("noResultsHint");

  const row = document.createElement("div");
  row.style.cssText = "display:flex;gap:6px";

  const input = document.createElement("input");
  input.id = "manual-search-input";
  input.type = "text";
  input.value = detection.title;
  input.style.cssText = "flex:1;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:6px;padding:7px 10px;font-size:13px;color:var(--text-primary);outline:none";

  const btn = document.createElement("button");
  btn.id = "btn-manual-search";
  btn.className = "btn btn-primary";
  btn.style.cssText = "width:auto;padding:7px 12px;flex-shrink:0";
  btn.textContent = "🔍";

  row.appendChild(input);
  row.appendChild(btn);
  li.appendChild(hint);
  li.appendChild(row);
  list.innerHTML = "";
  list.appendChild(li);

  const doSearch = async () => {
    const query = input.value.trim();
    if (!query) return;

    btn.textContent = "…";
    btn.disabled = true;

    const response = await chrome.runtime.sendMessage({
      type: "SEARCH_ANILIST",
      payload: { title: query, mediaType: detection.mediaType },
    });

    btn.textContent = "🔍";
    btn.disabled = false;

    if (response?.results && response.results.length > 0) {
      await updateTabState({ searchResults: response.results });
      list.innerHTML = "";
      showResults(response.results, detection);
      document.getElementById("results-label")!.textContent =
        detection.mediaType === "ANIME" ? t("selectAnime") : t("selectManga");
    } else {
      list.innerHTML = "";
      const noResult = document.createElement("li");
      noResult.style.cssText = "padding:8px 0;display:block";
      const noResultHint = document.createElement("p");
      noResultHint.className = "state-hint";
      noResultHint.textContent = t("noResultsRetry");
      noResult.appendChild(noResultHint);
      list.appendChild(noResult);
      showManualSearch(detection);
    }
  };

  btn.addEventListener("click", doSearch);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch();
  });
}

function showResults(results: AniListMedia[], detection?: MediaDetection) {
  const section = document.getElementById("results-section")!;
  const list = document.getElementById("results-list")!;
  section.style.display = "block";
  list.innerHTML = "";

  for (const media of results) {
    const li = document.createElement("li");

    const img = document.createElement("img");
    img.alt = "";
    try {
      const imgUrl = new URL(media.coverImage.medium);
      if (imgUrl.protocol === "https:") img.src = imgUrl.href;
    } catch { /* skip invalid URLs */ }

    const info = document.createElement("div");
    info.className = "info";

    const titleDiv = document.createElement("div");
    titleDiv.className = "title";
    titleDiv.textContent = media.title.english ?? media.title.romaji;

    const subtitleDiv = document.createElement("div");
    subtitleDiv.className = "subtitle";
    subtitleDiv.textContent = media.title.romaji;

    info.appendChild(titleDiv);
    info.appendChild(subtitleDiv);
    li.appendChild(img);
    li.appendChild(info);
    li.addEventListener("click", () => selectMedia(media));
    list.appendChild(li);
  }

  if (detection) {
    const li = document.createElement("li");
    li.style.cssText = "display:block;padding:6px 0 2px";
    const retryBtn = document.createElement("button");
    retryBtn.className = "btn btn-ghost";
    retryBtn.style.cssText = "width:100%;font-size:12px;padding:6px";
    retryBtn.textContent = t("searchOtherTitle");
    retryBtn.addEventListener("click", () => {
      list.innerHTML = "";
      document.getElementById("results-label")!.textContent = t("noResultsFound");
      showManualSearch(detection);
    });
    li.appendChild(retryBtn);
    list.appendChild(li);
  }
}

function showConfirm(detection: MediaDetection, progress: number | null, isManualMatch: boolean) {
  const section = document.getElementById("confirm-section")!;
  const btn = document.getElementById("btn-update") as HTMLButtonElement;

  section.querySelectorAll(".btn-change, .btn-report").forEach(el => el.remove());
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

  const changeBtn = document.createElement("button");
  changeBtn.className = "btn btn-ghost btn-change";
  changeBtn.style.marginTop = "6px";
  changeBtn.textContent = t("changeMapping");
  changeBtn.addEventListener("click", async () => {
    selectedMedia = null;
    section.style.display = "none";
    const resultsSection = document.getElementById("results-section")!;
    const resultsList = document.getElementById("results-list")!;
    resultsSection.style.display = "block";

    const tabState = await readTabState();
    const searchResults = tabState.searchResults;
    if (!searchResults || searchResults.length === 0) {
      resultsList.innerHTML = "";
      const loadingLi = document.createElement("li");
      loadingLi.style.cssText = "padding:8px;color:var(--text-muted)";
      loadingLi.textContent = t("stateLoading");
      resultsList.appendChild(loadingLi);
      const response = await chrome.runtime.sendMessage({
        type: "SEARCH_ANILIST",
        payload: { title: detection.title, mediaType: detection.mediaType },
      });
      if (response?.results && response.results.length > 0) {
        await updateTabState({ searchResults: response.results });
        showResults(response.results, detection);
      } else {
        showManualSearch(detection);
      }
    } else {
      showResults(searchResults, detection);
    }
  });

  section.appendChild(changeBtn);

  if (!isManualMatch && selectedMedia) {
    section.appendChild(buildReportButton(detection, selectedMedia));
  }

  btn.onclick = handleUpdateClick;
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

    const response = await chrome.runtime.sendMessage({
      type: "ALIAS_REPORT",
      payload: {
        alias: detection.title,
        mediaType: detection.mediaType,
        mediaId: media.id,
      },
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

async function selectMedia(media: AniListMedia) {
  selectedMedia = media;

  if (currentDetection) {
    const { saveTitleMapping } = await import("../utils/storage");
    await saveTitleMapping(currentDetection.title, currentDetection.mediaType, media.id);

    chrome.runtime.sendMessage({
      type: "ALIAS_SUBMIT",
      payload: {
        alias: currentDetection.title,
        mediaType: currentDetection.mediaType,
        mediaId: media.id,
        mediaTitle: media.title.english ?? media.title.romaji,
        sourceHostname: (() => {
          try { return new URL(currentDetection!.url).hostname; } catch { return null; }
        })(),
      },
    }).catch(() => {});
  }

  await updateTabState({ confirmedMediaManual: true });

  const response = await chrome.runtime.sendMessage({
    type: "GET_PROGRESS",
    payload: { mediaId: media.id },
  });

  const progress = response?.progress ?? null;
  if (progress !== null) {
    await updateTabState({ currentProgress: progress, confirmedMedia: media });
    const titleEl = document.getElementById("media-title");
    if (titleEl) titleEl.textContent = media.title.english ?? media.title.romaji;
    const progressHint = document.getElementById("progress-hint");
    if (progressHint) progressHint.textContent = `(${progress})`;
  }

  if (currentDetection) showConfirm(currentDetection, progress, true);
  document.getElementById("results-section")!.style.display = "none";
  document.getElementById("confirm-section")!.style.display = "block";
}

async function handleUpdateClick() {
  if (!selectedMedia || !currentDetection) return;

  const btn = document.getElementById("btn-update") as HTMLButtonElement;
  btn.textContent = t("stateLoading");
  btn.disabled = true;

  const response = await chrome.runtime.sendMessage({
    type: "UPDATE_PROGRESS",
    payload: {
      mediaId: selectedMedia.id,
      progress: currentDetection.progress,
      mediaType: currentDetection.mediaType,
    },
  });

  if (response?.success) {
    if (response.queued) {
      btn.textContent = t("updateQueued");
      btn.classList.remove("btn-success");
      btn.classList.add("btn-ghost");
      renderPendingQueue();
    } else {
      if (!response.skipped) {
        await updateTabState({ currentProgress: response.progress });
      }

      btn.textContent = response.skipped
        ? t("alreadyUpToDate", String(response.current))
        : t("updatedSuccess", String(response.progress));
      btn.classList.remove("btn-success");
      btn.classList.add("btn-ghost");
    }
  } else {
    btn.textContent = t("updateError");
    btn.disabled = false;
  }
}

btnLogin.addEventListener("click", async () => {
  btnLogin.textContent = t("stateLoading");
  const response = await chrome.runtime.sendMessage({ type: "GET_AUTH_TOKEN" });

  if (response?.success) {
    usernameEl.textContent = response.username;
    showView("main");
    await resolveState();
  } else if (response?.cancelled) {
    btnLogin.textContent = t("btnLogin");
  } else if (response?.timedOut) {
    btnLogin.textContent = t("btnLogin");
    alert(t("connectionTimeout"));
  } else {
    btnLogin.textContent = t("btnLogin");
    alert(t("connectionFailed"));
  }
});

btnSettings.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

function showView(view: "login" | "main") {
  loginView.style.display = view === "login" ? "block" : "none";
  mainView.style.display = view === "main" ? "block" : "none";
}

init();
