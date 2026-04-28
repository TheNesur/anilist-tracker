import { getStorage, setTheme, getTheme } from "../utils/storage";
import type { AniListMedia, MangaDetection, PopupState, SupportedSite } from "../types";
import { t } from "../utils/i18n";

const SUPPORTED_HOSTNAMES: Record<string, SupportedSite> = {
  "asuracomic.net": "asura",
  "www.asuracomic.net": "asura",
  "flamecomics.xyz": "flame",
  "www.flamecomics.xyz": "flame",
  "reaperscans.com": "reaper",
  "www.reaperscans.com": "reaper",
  "raijin-scans.fr": "raijin",
  "www.raijin-scans.fr": "raijin",
  "webtoons.com": "webtoon",
  "www.webtoons.com": "webtoon",
  "mangadex.org": "mangadex",
  "www.mangadex.org": "mangadex",
  "mangaplus.shueisha.co.jp": "mangaplus",
};

const SITE_NAMES: Record<SupportedSite, string> = {
  asura: "Asura Comics",
  flame: "Flame Comics",
  reaper: "Reaper Scans",
  luminous: "Luminous Scans",
  raijin: "Raijin Scans",
  webtoon: "Webtoon",
  mangadex: "MangaDex",
  mangaplus: "MangaPlus",
};

const loginView = document.getElementById("login-view")!;
const mainView = document.getElementById("main-view")!;
const btnLogin = document.getElementById("btn-login")!;
const usernameEl = document.getElementById("username")!;
const stateContainer = document.getElementById("state-container")!;
const btnSettings = document.getElementById("btn-settings")!;

let currentDetection: MangaDetection | null = null;
let selectedMediaId: number | null = null;

async function init() {
  const storage = await getStorage();
  const theme = await getTheme();
  applyTheme(theme);


  document.getElementById("login-description")!.textContent = t("loginDescription");
  document.getElementById("btn-login")!.textContent = t("btnLogin");

  if (!storage.accessToken) {
    showView("login");
    return;
  }

  showView("main");
  usernameEl.textContent = storage.username ?? (storage.userId ? `#${storage.userId}` : "—");
  await resolveState();


  chrome.storage.session.onChanged.addListener((changes) => {
    if (changes.lastDetection || changes.lastDetectionUrl || changes.detectionFailed) {
      resolveState();
    }
  });

  document.getElementById("footer-anilist")!.textContent = t("openAniList");
}

function applyTheme(theme: "dark" | "light") {
  document.documentElement.setAttribute("data-theme", theme);
}

async function resolveState() {
  renderState({ type: "loading" });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });  
  const url = tab?.url;

  if (!url || url.startsWith("chrome://") || url.startsWith("edge://") || url.startsWith("about:")) {
    renderState({ type: "unsupported_site", hostname: "cette page système" });
    return;
  }

  const hostname = new URL(url).hostname;
  const site = SUPPORTED_HOSTNAMES[hostname];

  if (!site) {
    renderState({ type: "unsupported_site", hostname });
    return;
  }

  const session = await chrome.storage.session.get([
    "lastDetection",
    "searchResults",
    "confirmedMediaId",
    "currentProgress",
    "detectionFailed",
    "lastDetectionUrl",
    "tokenExpired",
  ]);

  if (session.tokenExpired) {
    renderState({ type: "error", message: t("tokenExpired") });
    // Show reconnect button
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

  const lastUrl = session.lastDetectionUrl as string | null;
  const isCurrentPage = lastUrl && new URL(lastUrl).hostname === hostname && lastUrl === url;

  if (session.detectionFailed && isCurrentPage) {
    renderState({ type: "detection_failed", site });
    return;
  }

  if (!session.lastDetection || !isCurrentPage) {
    renderState({ type: "unsupported_page", site });
    return;
  }

  currentDetection = session.lastDetection as MangaDetection;
  selectedMediaId = (session.confirmedMediaId as number | null) ?? null;

  renderState({
    type: "detected",
    detection: currentDetection,
    progress: (session.currentProgress as number | null) ?? null,
    mediaId: selectedMediaId,
    searchResults: selectedMediaId ? null : (session.searchResults as AniListMedia[] | null),
  });
}

function renderState(state: PopupState) {
  stateContainer.innerHTML = "";

  switch (state.type) {
    case "loading":
      stateContainer.innerHTML = `
        <div class="state-box">
          <div class="spinner"></div>
          <p class="state-text">${t("stateLoading")}</p>
        </div>`;
      break;

    case "unsupported_site":
      stateContainer.innerHTML = `
        <div class="state-box">
          <div class="state-icon">🌐</div>
          <p class="state-title">${t("stateUnsupportedSite")}</p>
          <p class="state-text"><strong>${state.hostname}</strong> ${t("stateUnsupportedSiteText")}</p>
          <p class="state-hint">${t("stateSupportedSites")}</p>
        </div>`;
      break;

    case "unsupported_page":
      stateContainer.innerHTML = `
        <div class="state-box">
          <div class="state-icon">📖</div>
          <p class="state-title">${t("stateNoChapter")}</p>
          <p class="state-text">${t("youAreOn")} <strong>${SITE_NAMES[state.site]}</strong>.</p>
          <p class="state-hint">${t("stateNoChapterText")}</p>
        </div>`;
      break;

    case "detection_failed":
      stateContainer.innerHTML = `
        <div class="state-box">
          <div class="state-icon">⚠️</div>
          <p class="state-title">${t("stateDetectionFailed")}</p>
          <p class="state-text">${t("stateDetectionFailedText")}</p>
          <p class="state-hint">${t("stateDetectionFailedHint")} <a href="https://github.com/TheNesur/anilist-tracker/issues" target="_blank">${t("reportBug")}</a></p>
        </div>`;
      break;

    case "detected":
      renderDetected(state);
      break;

    case "error":
      stateContainer.innerHTML = `
        <div class="state-box">
          <div class="state-icon">❌</div>
          <p class="state-title">t("errorTitle")</p>
          <p class="state-text">${state.message}</p>
        </div>`;
      break;
  }
}

function renderDetected(state: Extract<PopupState, { type: "detected" }>) {
  const { detection, progress, mediaId, searchResults } = state;

  const chapterText = progress !== null
    ? `${t("chapterLabel", String(detection.chapter))} <span class="progress-hint">(${t("youAreOn")} ${progress})</span>`
    : t("chapterLabel", String(detection.chapter));

  stateContainer.innerHTML = `
    <div class="detection-card">
      <div class="manga-title">${detection.title}</div>
      <div class="manga-chapter">${chapterText}</div>
      <div class="manga-source">${t("sourceLabel")} : ${detection.source} · ${new URL(detection.url).hostname}</div>
    </div>
    <div id="results-section" style="display:none">
      <p class="results-label">${t("selectManga")}</p>
      <ul class="results-list" id="results-list"></ul>
    </div>
    <div id="confirm-section" style="display:none">
      <button class="btn btn-success" id="btn-update" style="width:100%">${t("updateBtn")}</button>
    </div>`;

  if (mediaId) {
    showConfirm(detection, progress);
  } else if (searchResults && searchResults.length > 0) {
    showResults(searchResults);
  }
}

function showResults(results: AniListMedia[]) {
  const section = document.getElementById("results-section")!;
  const list = document.getElementById("results-list")!;
  section.style.display = "block";
  list.innerHTML = "";

  for (const media of results) {
    const li = document.createElement("li");
    li.innerHTML = `
      <img src="${media.coverImage.medium}" alt="" />
      <div class="info">
        <div class="title">${media.title.english ?? media.title.romaji}</div>
        <div class="subtitle">${media.title.romaji}</div>
      </div>`;
    li.addEventListener("click", () => selectMedia(media));
    list.appendChild(li);
  }
}

function showConfirm(detection: MangaDetection, progress: number | null) {
  const section = document.getElementById("confirm-section")!;
  const btn = document.getElementById("btn-update") as HTMLButtonElement;

  section.querySelectorAll(".btn-change").forEach(el => el.remove());
  
  section.style.display = "block";

  if (progress !== null && detection.chapter <= progress) {
    btn.textContent = t("alreadyUpToDate", String(progress));
    btn.classList.remove("btn-success");
    btn.classList.add("btn-ghost");
    btn.disabled = true;
  } else if (progress !== null) {
    btn.textContent = t("updateBtnProgress", String(progress), String(detection.chapter));
  } else {
    btn.textContent = t("updateBtn");
  }

  const changeBtn = document.createElement("button");
  changeBtn.className = "btn btn-ghost btn-change";
  changeBtn.style.marginTop = "6px";
  changeBtn.textContent = t("changeMapping");
  changeBtn.addEventListener("click", async () => {
    //const { removeTitleMapping } = await import("../utils/storage");
    //await removeTitleMapping(detection.title);
    selectedMediaId = null;

    section.style.display = "none";
    const resultsSection = document.getElementById("results-section")!;
    const resultsList = document.getElementById("results-list")!;
    resultsSection.style.display = "block";

    // If no cached results, re-search AniList
    const session = await chrome.storage.session.get(["searchResults"]);
    if (!session.searchResults || (session.searchResults as AniListMedia[]).length === 0) {
      resultsList.innerHTML = `<li style="padding:8px;color:var(--text-muted)">Searching...</li>`;
      const response = await chrome.runtime.sendMessage({
        type: "SEARCH_ANILIST",
        payload: { title: detection.title },
      });
      if (response?.results) {
        await chrome.storage.session.set({ searchResults: response.results });
        showResults(response.results);
      }
    } else {
      showResults(session.searchResults as AniListMedia[]);
    }
  });

  section.appendChild(changeBtn);
  btn.addEventListener("click", handleUpdate);
}

async function selectMedia(media: AniListMedia) {
  selectedMediaId = media.id;

  if (currentDetection) {
    const { saveTitleMapping } = await import("../utils/storage");
    await saveTitleMapping(currentDetection.title, media.id);
  }

  const response = await chrome.runtime.sendMessage({
    type: "GET_PROGRESS",
    payload: { mediaId: media.id },
  });

  const progress = response?.progress ?? null;
  if (progress !== null) {
    await chrome.storage.session.set({ currentProgress: progress, confirmedMediaId: media.id });
  }

  if (currentDetection) showConfirm(currentDetection, progress);
  document.getElementById("results-section")!.style.display = "none";
  document.getElementById("confirm-section")!.style.display = "block";
}

async function handleUpdate() {
  if (!selectedMediaId || !currentDetection) return;

  const btn = document.getElementById("btn-update") as HTMLButtonElement;
  btn.textContent = t("stateLoading");
  btn.disabled = true;

  const response = await chrome.runtime.sendMessage({
    type: "UPDATE_PROGRESS",
    payload: { mediaId: selectedMediaId, chapter: currentDetection.chapter },
  });

  if (response?.success) {
    btn.textContent = response.skipped
      ? t("alreadyUpToDate", String(response.current))
      : t("updatedSuccess", String(response.progress));
    btn.classList.remove("btn-success");
    btn.classList.add("btn-ghost");
    chrome.action.setBadgeText({ text: "" });
  } else {
    btn.textContent = t("updateError");
    btn.disabled = false;
  }
}

// Login
btnLogin.addEventListener("click", async () => {
  btnLogin.textContent = t("stateLoading");
  const response = await chrome.runtime.sendMessage({ type: "GET_AUTH_TOKEN" });

  if (response?.success) {
    usernameEl.textContent = response.username;
    showView("main");
    await resolveState();
  } else {
    btnLogin.textContent = t("btnLogin");
    alert(t("connectionFailed"));
  }
});

// Settings
btnSettings.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

function showView(view: "login" | "main") {
  loginView.style.display = view === "login" ? "block" : "none";
  mainView.style.display = view === "main" ? "block" : "none";
}

init();