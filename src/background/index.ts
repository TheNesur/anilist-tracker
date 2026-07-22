import { searchManga, searchAnime, getProgress, updateProgress, getViewer, getMediaById } from "../utils/anilist";
import { getStorage, setStorage, getToken, getTitleMapping, saveTitleMapping } from "../utils/storage";
import { findExactMatch } from "../utils/matching";
import { isTokenExpiredError, type MediaDetection, type AniListMedia } from "../types";
import { normalizeSearchTitle } from "../parsers/utils";


const CLIENT_ID = import.meta.env.VITE_ANILIST_CLIENT_ID;
const REDIRECT_URL = import.meta.env.VITE_ANILIST_REDIRECT_URI;
const TOKEN_ENDPOINT = import.meta.env.VITE_TOKEN_ENDPOINT || "https://auth.mraitchkovitch.fr/callback";

const STATE_STORAGE_KEY = "oauthState";
const BADGE_CLEAR_ALARM = "anilist-tracker:clear-badge";
const BADGE_CLEAR_DELAY_MIN = 0.05;
const VIEWER_RETRY_DELAYS_MS = [500, 1000, 2000];

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === BADGE_CLEAR_ALARM) {
    chrome.action.setBadgeText({ text: "" });
  }
});

function scheduleBadgeClear() {
  chrome.alarms.create(BADGE_CLEAR_ALARM, { delayInMinutes: BADGE_CLEAR_DELAY_MIN });
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "MEDIA_DETECTED") {
    handleDetection(message.payload as MediaDetection);
  }

  if (message.type === "UPDATE_PROGRESS") {
    const { mediaId, progress, mediaType } = message.payload as {
      mediaId: number;
      progress: number;
      mediaType: MediaDetection["mediaType"];
    };
    handleUpdate(mediaId, progress, mediaType).then(sendResponse);
    return true;
  }

  if(message.type === "LOCAL_UPDATE_PROGRESS") {
    (async () => {
      const { progress } = message.payload as { progress: number };
      const { lastDetection } = await chrome.storage.session.get('lastDetection');

      lastDetection.progress = progress;
      
      chrome.storage.session.set({ lastDetection });
    })();
  }

  if (message.type === "GET_AUTH_TOKEN") {
    startOAuth().then(sendResponse);
    return true;
  }

  if (message.type === "GET_PROGRESS") {
    const { mediaId } = message.payload as { mediaId: number };
    (async () => {
      const token = await getToken();
      const storage = await getStorage();
      if (token && storage.userId) {
        try {
          const entry = await getProgress(mediaId, storage.userId, token);
          sendResponse({ progress: entry?.progress ?? 0 });
        } catch (err) {
          if (isTokenExpiredError(err)) {
            await handleTokenExpired();
          }
          sendResponse({ progress: null });
        }
      } else {
        sendResponse({ progress: null });
      }
    })();
    return true;
  }

  if (message.type === "SEARCH_ANILIST") {
    const { title, mediaType } = message.payload as { title: string; mediaType: MediaDetection["mediaType"] };
    const searchTitle = normalizeSearchTitle(title);
    const search = mediaType === "ANIME" ? searchAnime(searchTitle) : searchManga(searchTitle);
    search.then((results: AniListMedia[]) => sendResponse({ results }));
    return true;
  }
});

function generateState(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function getViewerWithRetry(token: string) {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= VIEWER_RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await getViewer(token);
    } catch (err) {
      lastErr = err;
      if (isTokenExpiredError(err)) throw err;
      if (attempt < VIEWER_RETRY_DELAYS_MS.length) {
        await sleep(VIEWER_RETRY_DELAYS_MS[attempt]);
      }
    }
  }
  throw lastErr;
}

async function startOAuth() {
  const state = generateState();
  await chrome.storage.session.set({ [STATE_STORAGE_KEY]: state });

  const authUrl =
    `https://anilist.co/api/v2/oauth/authorize` +
    `?client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URL)}` +
    `&response_type=code` +
    `&state=${encodeURIComponent(state)}`;

  try {
    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true,
    });

    if (!responseUrl) {
      await chrome.storage.session.remove(STATE_STORAGE_KEY);
      return { success: false };
    }

    const url = new URL(responseUrl);
    const code = url.searchParams.get("code");
    const returnedState = url.searchParams.get("state");

    const stored = await chrome.storage.session.get(STATE_STORAGE_KEY);
    const expectedState = stored[STATE_STORAGE_KEY] as string | undefined;
    await chrome.storage.session.remove(STATE_STORAGE_KEY);

    if (!expectedState || !returnedState || returnedState !== expectedState) {
      console.error("[AniList Tracker] OAuth state mismatch — possible CSRF");
      return { success: false, error: "State mismatch" };
    }

    if (!code) {
      return { success: false, error: "No code received" };
    }

    const tokenRes = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, redirect_uri: REDIRECT_URL }),
    });

    const tokenData = await tokenRes.json().catch(() => null);

    if (!tokenData || tokenData.ok === false || !tokenData.access_token) {
      console.error("[AniList Tracker] Token exchange failed");
      return { success: false, error: "Token exchange failed" };
    }

    const accessToken = tokenData.access_token as string;

    await setStorage({ accessToken });

    try {
      const viewer = await getViewerWithRetry(accessToken);
      await setStorage({ userId: viewer.id, username: viewer.name });
      return { success: true, username: viewer.name };
    } catch (err) {
      console.error("[AniList Tracker] getViewer failed after retries:", err);
      await chrome.storage.session.set({ viewerFetchFailed: true });
      return { success: true, username: null, partial: true };
    }
  } catch (err) {
    await chrome.storage.session.remove(STATE_STORAGE_KEY).catch(() => {});

    const errMsg = String(err);
    if (
      errMsg.includes("canceled") ||
      errMsg.includes("cancelled") ||
      errMsg.includes("user did not approve") ||
      errMsg.includes("Authorization page could not be loaded")
    ) {
      return { success: false, cancelled: true };
    }

    console.error("[AniList Tracker] OAuth error:", err);
    return { success: false, error: String(err) };
  }
}

async function handleTokenExpired() {
  await setStorage({ accessToken: null });
  chrome.action.setBadgeText({ text: "!" });
  chrome.action.setBadgeBackgroundColor({ color: "#e74c3c" });
  await chrome.storage.session.set({ tokenExpired: true });
}

async function ensureViewerLoaded(token: string): Promise<number | null> {
  const storage = await getStorage();
  if (storage.userId) return storage.userId;

  try {
    const viewer = await getViewerWithRetry(token);
    await setStorage({ userId: viewer.id, username: viewer.name });
    await chrome.storage.session.remove("viewerFetchFailed");
    return viewer.id;
  } catch {
    return null;
  }
}

async function handleDetection(detection: MediaDetection) {
  chrome.storage.session.set({
    lastDetectionUrl: detection.url,
    lastDetection: null,
    detectionSearching: true,
    detectionSearchingPreview: {
      title: detection.title,
      progress: detection.progress,
      mediaType: detection.mediaType,
    },
  });

  const token = await getToken();
  if (!token) {
    chrome.action.setBadgeText({ text: "!" });
    chrome.action.setBadgeBackgroundColor({ color: "#e74c3c" });
    await chrome.storage.session.set({ detectionSearching: false });
    return;
  }

  await chrome.storage.session.remove("apiError");

  try {
    let mediaId = await getTitleMapping(detection.title);

    if (!mediaId) {
      const searchTitle = normalizeSearchTitle(detection.title);
      const results = detection.mediaType === "ANIME"
        ? await searchAnime(searchTitle)
        : await searchManga(searchTitle);

      if (results.length === 0) {
        notifyUser(detection, []);
        return;
      }

      const settings = await getStorage();
      if (settings.autoMap) {
        const exactMatch = findExactMatch(detection.title, results);
        if (exactMatch) {
          await saveTitleMapping(detection.title, exactMatch.id);
          mediaId = exactMatch.id;
        }
      }

      if (!mediaId) {
        notifyUser(detection, results);
        return;
      }
    }

    const userId = await ensureViewerLoaded(token);
    let currentProgress: number | null = null;
    if (userId) {
      const entry = await getProgress(mediaId, userId, token);
      currentProgress = entry?.progress ?? null;
    }

    const storage = await getStorage();
    if (storage.autoUpdate && (currentProgress === null || detection.progress > currentProgress)) {
      await handleUpdate(mediaId, detection.progress, detection.mediaType);
    } else {
      const media = await getMediaById(mediaId);
      if (media)
        notifyUser(detection, null, media, currentProgress);
      else
        console.error("[AniList Tracker] Media not found by id", mediaId);
    }
  } catch (err) {
    if (isTokenExpiredError(err)) {
      await handleTokenExpired();
    } else {
      console.error("[AniList Tracker] Detection handling failed:", err);
      await chrome.storage.session.set({
        apiError: err instanceof Error ? err.message : String(err),
        lastDetectionUrl: detection.url,
      });
    }
  } finally {
    await chrome.storage.session.set({ detectionSearching: false });
  }
}

async function handleUpdate(mediaId: number, progress: number, mediaType: MediaDetection["mediaType"] = "MANGA") {
  const token = await getToken();
  if (!token) return { success: false, error: "Not authenticated" };

  const userId = await ensureViewerLoaded(token);
  if (!userId) return { success: false, error: "No user ID" };

  try {
    const current = await getProgress(mediaId, userId, token);

    if (current && current.progress >= progress) {
      return { success: true, skipped: true, current: current.progress };
    }

    const result = await updateProgress(mediaId, progress, token);

    chrome.action.setBadgeText({ text: "✓" });
    chrome.action.setBadgeBackgroundColor({ color: "#2ecc71" });
    scheduleBadgeClear();

    void mediaType;
    return { success: true, progress: result.progress };
  } catch (err) {
    if (isTokenExpiredError(err)) {
      await handleTokenExpired();
      return { success: false, error: "Token expired" };
    }
    console.error("[AniList Tracker] Update failed:", err);
    return { success: false, error: String(err) };
  }
}

function notifyUser(
  detection: MediaDetection,
  searchResults: AniListMedia[] | null,
  confirmedMedia?: AniListMedia,
  currentProgress?: number | null
) {
  if(currentProgress === null) currentProgress = 0;

  chrome.storage.session.set({
    lastDetection: detection,
    searchResults,
    confirmedMedia: confirmedMedia ?? null,
    currentProgress: currentProgress ?? null,
    lastDetectionUrl: detection.url,
    confirmedSiteUrl: confirmedMedia?.id
      ? `https://anilist.co/${detection.mediaType === "ANIME" ? "anime" : "manga"}/${confirmedMedia.id}`
      : null,
  });

  chrome.action.setBadgeText({ text: "?" });
  chrome.action.setBadgeBackgroundColor({ color: "#3498db" });
}