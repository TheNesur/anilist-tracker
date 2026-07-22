import { getStorage, setTheme, getTheme } from "../utils/storage";
import type { AniListMedia, MediaDetection, PopupState, SupportedSite, GenericDetectionResult, MediaType } from "../types";
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

  "crunchyroll.com": "crunchyroll",
  "www.crunchyroll.com": "crunchyroll",

  "voir-anime.to": "voiranime",
  "www.voir-anime.to": "voiranime",

  "anime-sama.to": "anime-sama"
};

const SITE_NAMES: Record<SupportedSite, string> = {
  asura: "Asura Comics",
  flame: "Flame Comics",
  reaper: "Reaper Scans",
  raijin: "Raijin Scans",
  webtoon: "Webtoon",
  mangadex: "MangaDex",
  mangaplus: "MangaPlus",
  crunchyroll: "Crunchyroll",
  voiranime: "Voir Anime",
  "anime-sama": "Anime Sama",
  generic: "Generic Site"
};

const ANIME_SITES = new Set<SupportedSite>([
  "crunchyroll",
  "voiranime",
  "anime-sama"
]);

const loginView = document.getElementById("login-view")!;
const mainView = document.getElementById("main-view")!;
const btnLogin = document.getElementById("btn-login")!;
const usernameEl = document.getElementById("username")!;
const stateContainer = document.getElementById("state-container")!;
const btnSettings = document.getElementById("btn-settings")!;

let currentDetection: MediaDetection | null = null;
let selectedMedia: AniListMedia | null = null;

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

async function tryGenericDetection(tabId: number): Promise<GenericDetectionResult | null> {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        function extractChapterNumber(text: string): number | null {
          const match = text.match(/(?:chapter|chapitre|ch\.?|ep|episode|épisode)\s*([\d]+(?:\.[\d]+)?)/i);
          if (match) return parseFloat(match[1]);
          const numbers = text.match(/(\d+(?:\.\d+)?)/g);
          if (numbers && numbers.length > 0) {
            return parseFloat(numbers[numbers.length - 1]);
          }
          return null;
        }

        const TYPE_WORDS = "manga|manhwa|manhua|webtoon|comic";
        function cleanTitle(raw: string): string {
          return raw
            .replace(new RegExp(`^\\s*(${TYPE_WORDS})\\s+`, "i"), "")
            .replace(new RegExp(`\\s+(${TYPE_WORDS})\\s*$`, "i"), "")
            .replace(/\s+/g, " ")
            .trim();
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

        function extractFromDocTitle(): string | null {
          const parts = document.title.split(/\s*[-|·–]\s*/).filter(Boolean);
          if (parts.length === 0) return null;
          return parts.reduce((longest, part) => (part.length > longest.length ? part : longest), parts[0]);
        }

        function extractTitle(): string | null {
          const ogTitle = document.querySelector<HTMLMetaElement>("meta[property='og:title']")?.content?.trim();
          const twitterTitle = document.querySelector<HTMLMetaElement>("meta[name='twitter:title']")?.content?.trim();
          const h1 = document.querySelector("h1")?.textContent?.trim();
          const candidate = ogTitle || twitterTitle || h1 || extractFromDocTitle();
          return candidate ? cleanTitle(candidate) : null;
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
  chrome.runtime.sendMessage({ type: "MEDIA_DETECTED", payload: detection }).catch(() => {});
}

async function resolveState() {
  renderState({ type: "loading" });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url;

  if (!url || url.startsWith("chrome://") || url.startsWith("edge://") || url.startsWith("about:")) {
    renderState({ type: "unsupported_site", hostname: "system page" });
    return;
  }

  const hostname = new URL(url).hostname;
  const site = SUPPORTED_HOSTNAMES[hostname];

  if (!site) {
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

  const session = await chrome.storage.session.get([
    "lastDetection",
    "searchResults",
    "confirmedMedia",
    "currentProgress",
    "detectionFailed",
    "lastDetectionUrl",
    "tokenExpired",
    "apiError",
  ]);


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

  const lastUrl = session.lastDetectionUrl as string | null;
  const isCurrentPage = lastUrl && new URL(lastUrl).hostname === hostname && lastUrl === url;


  if (session.apiError && isCurrentPage) {
    renderState({ type: "error", message: session.apiError as string });
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

  currentDetection = session.lastDetection as MediaDetection;
  selectedMedia = (session.confirmedMedia as AniListMedia | null) ?? null;

  renderState({
    type: "detected",
    detection: currentDetection,
    progress: (session.currentProgress as number | null) ?? null,
    media: selectedMedia,
    searchResults: selectedMedia ? null : (session.searchResults as AniListMedia[] | null),
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
          <button class="btn btn-ghost" id="btn-retry-generic" style="margin-top:10px">${t("retryDetection")}</button>
        </div>`;
      document.getElementById("btn-retry-generic")!.addEventListener("click", resolveState);
      break;

    case "generic_type_pick":
      stateContainer.innerHTML = `
        <div class="state-box">
          <div class="state-icon">🤔</div>
          <p class="state-title">${state.candidate.title}</p>
          <p class="state-text">${t("chapterLabel", String(state.candidate.progress))}</p>
          <p class="state-hint" style="margin-bottom:10px">${t("askMediaType")}</p>
          <div style="display:flex;gap:8px">
            <button class="btn btn-primary" id="pick-manga">📖 ${t("typeManga")}</button>
            <button class="btn btn-primary" id="pick-anime">📺 ${t("typeAnime")}</button>
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
      const isAnimeSite = ANIME_SITES.has(state.site);
      stateContainer.innerHTML = `
        <div class="state-box">
          <div class="state-icon">${isAnimeSite ? "📺" : "📖"}</div>
          <p class="state-title">${isAnimeSite ? t("stateNoEpisode") : t("stateNoChapter")}</p>
          <p class="state-text">${t("youAreOn")} <strong>${SITE_NAMES[state.site]}</strong>.</p>
          <p class="state-hint">${isAnimeSite ? t("stateNoEpisodeText") : t("stateNoChapterText")}</p>
        </div>`;
      break;
    }

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
          <p class="state-title">${t("errorTitle")}</p>
          <p class="state-text">${t("apiError")}</p>
          <p class="state-hint"><a href="https://discord.gg/TF428cr" target="_blank">${t("apiErrorHint")}</a></p>
        </div>`;
      break;
  }
}

function renderDetected(state: Extract<PopupState, { type: "detected" }>) {
  const { detection, progress, media, searchResults } = state;

  const isAnime = detection.mediaType === "ANIME";
  const progressLabel = isAnime
    ? t("episodeLabel", String(detection.progress))
    : t("chapterLabel", String(detection.progress));

  const progressText = progress !== null
    ? `${progressLabel} <span class="progress-hint" id="progress-hint">(${progress})</span>`
    : progressLabel;

  stateContainer.innerHTML = `
    <div class="detection-card">
      <div class="media-title" id="media-title">${media?.title.english ?? media?.title.romaji ?? detection.title}</div>
      <div class="media-progress">${progressText}</div>
      <div class="media-source">${t("sourceLabel")} : ${detection.source} · ${new URL(detection.url).hostname}</div>
    </div>
    <div id="results-section" style="display:none">
      <p class="results-label" id="results-label">${isAnime ? t("selectAnime") : t("selectManga")}</p>
      <ul class="results-list" id="results-list"></ul>
    </div>
    <div id="confirm-section" style="display:none">
      <button class="btn btn-success" id="btn-update" style="width:100%">${t("updateBtn")}</button>
    </div>`;

  if (media) {
    showConfirm(detection, progress);
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

  list.innerHTML = `
    <li style="padding:4px 0 10px;display:block">
      <p class="state-hint" style="margin-bottom:8px">${t("noResultsHint")}</p>
      <div style="display:flex;gap:6px">
        <input
          id="manual-search-input"
          type="text"
          value="${detection.title}"
          style="
            flex:1;
            background:var(--bg-tertiary);
            border:1px solid var(--border);
            border-radius:6px;
            padding:7px 10px;
            font-size:13px;
            color:var(--text-primary);
            outline:none;
          "
        />
        <button id="btn-manual-search" class="btn btn-primary" style="width:auto;padding:7px 12px;flex-shrink:0">
          🔍
        </button>
      </div>
    </li>`;

  const input = document.getElementById("manual-search-input") as HTMLInputElement;
  const btn = document.getElementById("btn-manual-search") as HTMLButtonElement;

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
      await chrome.storage.session.set({ searchResults: response.results });
      list.innerHTML = "";
      showResults(response.results, detection);
      document.getElementById("results-label")!.textContent =
        detection.mediaType === "ANIME" ? t("selectAnime") : t("selectManga");
    } else {
      list.innerHTML = `
        <li style="padding:8px 0;display:block">
          <p class="state-hint">${t("noResultsRetry")}</p>
        </li>`;
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
    li.innerHTML = `
      <img src="${media.coverImage.medium}" alt="" />
      <div class="info">
        <div class="title">${media.title.english ?? media.title.romaji}</div>
        <div class="subtitle">${media.title.romaji}</div>
      </div>`;
    li.addEventListener("click", () => selectMedia(media));
    list.appendChild(li);
  }

  if (detection) {
    const li = document.createElement("li");
    li.style.cssText = "display:block;padding:6px 0 2px";
    li.innerHTML = `
      <button id="btn-retry-search" class="btn btn-ghost" style="width:100%;font-size:12px;padding:6px">
        ${t("searchOtherTitle")}
      </button>`;
    li.querySelector("#btn-retry-search")!.addEventListener("click", () => {
      list.innerHTML = "";
      document.getElementById("results-label")!.textContent = t("noResultsFound");
      showManualSearch(detection);
    });
    list.appendChild(li);
  }
}

function showConfirm(detection: MediaDetection, progress: number | null) {
  const section = document.getElementById("confirm-section")!;
  const btn = document.getElementById("btn-update") as HTMLButtonElement;

  section.querySelectorAll(".btn-change").forEach(el => el.remove());
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

    const session = await chrome.storage.session.get(["searchResults"]);
    if (!session.searchResults || (session.searchResults as AniListMedia[]).length === 0) {
      resultsList.innerHTML = `<li style="padding:8px;color:var(--text-muted)">${t("stateLoading")}</li>`;
      const response = await chrome.runtime.sendMessage({
        type: "SEARCH_ANILIST",
        payload: { title: detection.title, mediaType: detection.mediaType },
      });
      if (response?.results && response.results.length > 0) {
        await chrome.storage.session.set({ searchResults: response.results });
        showResults(response.results, detection);
      } else {
        showManualSearch(detection);
      }
    } else {
      showResults(session.searchResults as AniListMedia[], detection);
    }
  });

  section.appendChild(changeBtn);
  btn.addEventListener("click", handleUpdate);
}

async function selectMedia(media: AniListMedia) {
  selectedMedia = media;

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
    await chrome.storage.session.set({ currentProgress: progress, confirmedMedia: media });
    document.getElementById("media-title")!.innerText = media.title.english ?? media.title.romaji;
    const progressHint = document.getElementById("progress-hint");
    if(progressHint)
      progressHint.innerText = `(${progress})`;
  }

  if (currentDetection) showConfirm(currentDetection, progress);
  document.getElementById("results-section")!.style.display = "none";
  document.getElementById("confirm-section")!.style.display = "block";
}

async function handleUpdate() {
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
    if (!response.skipped) {
      await chrome.storage.session.set({ currentProgress: response.progress });
    }

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

btnLogin.addEventListener("click", async () => {
  btnLogin.textContent = t("stateLoading");
  const response = await chrome.runtime.sendMessage({ type: "GET_AUTH_TOKEN" });

  if (response?.success) {
    usernameEl.textContent = response.username;
    showView("main");
    await resolveState();
  } else if (response?.cancelled) {
    btnLogin.textContent = t("btnLogin");
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