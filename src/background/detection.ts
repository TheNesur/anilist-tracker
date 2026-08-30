import { errMsg } from "../utils/dom";
import { searchManga, searchAnime, getProgress, getMediaById, getProgressCollection } from "../utils/anilist";
import { getStorage, setStorage, getToken, getTitleMapping, saveTitleMapping } from "../utils/storage";
import { findExactMatch } from "../utils/matching";
import { isTokenExpiredError, type MediaDetection, type AniListMedia } from "../types";
import { normalizeSearchTitle } from "../parsers/utils";
import { lookupAlias } from "./alias";
import { handleUpdate } from "./progress";
import { ensureViewerLoaded, handleTokenExpired } from "./oauth";
import { setTabState } from "./tab-state";

const PROGRESS_CACHE_TTL_MS = 15 * 60 * 1000;

export async function handleDetection(detection: MediaDetection, tabId: number) {
  await setTabState(tabId, {
    lastDetectionUrl: detection.url,
    lastDetection: null,
    detectionFailed: false,
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
    await setTabState(tabId, { detectionSearching: false });
    return;
  }

  await setTabState(tabId, { apiError: null });

  const storage = await getStorage();

  try {
    let mediaId = storage.titleMappings[detection.title] ?? null;

    if (!mediaId) {
      const searchTitle = normalizeSearchTitle(detection.title);
      const results = detection.mediaType === "ANIME"
        ? await searchAnime(searchTitle)
        : await searchManga(searchTitle);

      if (results.length === 0) {
        const alias = await lookupAlias(detection.title, detection.mediaType);
        if (alias) {
          const media = await getMediaById(alias.mediaId).catch(() => null);
          if (media) {
            await saveTitleMapping(detection.title, media.id);
            mediaId = media.id;
          }
        }

        if (!mediaId) {
          notifyUser(tabId, detection, []);
          return;
        }
      } else {
        if (storage.autoMap) {
          const exactMatch = findExactMatch(detection.title, results);
          if (exactMatch) {
            await saveTitleMapping(detection.title, exactMatch.id);
            mediaId = exactMatch.id;
          }
        }

        if (!mediaId) {
          notifyUser(tabId, detection, results);
          return;
        }
      }
    }

    const userId = await ensureViewerLoaded(token);
    let currentProgress: number | null = null;
    if (userId) {
      const entry = await getProgress(mediaId, userId, token);
      currentProgress = entry?.progress ?? null;
    }

    if (storage.autoUpdate && (currentProgress === null || detection.progress > currentProgress)) {
      const result = await handleUpdate(mediaId, detection.progress, detection.mediaType);
      const media = await getMediaById(mediaId);
      if (media) {
        const newProgress = result?.progress ?? detection.progress;
        notifyUser(tabId, detection, null, media, newProgress);
      }
    } else {
      const media = await getMediaById(mediaId);
      if (media) {
        notifyUser(tabId, detection, null, media, currentProgress);
      } else {
        console.error("[AniList Tracker] Media not found by id", mediaId);
      }
    }
  } catch (err) {
    if (isTokenExpiredError(err)) {
      await handleTokenExpired();
    } else {
      console.error("[AniList Tracker] Detection handling failed:", errMsg(err));
      await setTabState(tabId, {
        apiError: errMsg(err),
        lastDetectionUrl: detection.url,
      });
    }
  } finally {
    await setTabState(tabId, { detectionSearching: false });
  }
}

export async function handleGetProgressCache(mediaType: MediaDetection["mediaType"]) {
  if (mediaType !== "MANGA") {
    return { cache: {} };
  }

  const token = await getToken();
  const storage = await getStorage();
  if (!token || !storage.userId) {
    return { cache: {} };
  }

  const isStale =
    !storage.mangaProgressCacheUpdatedAt ||
    Date.now() - storage.mangaProgressCacheUpdatedAt > PROGRESS_CACHE_TTL_MS;

  if (!isStale) {
    return { cache: storage.mangaProgressCache };
  }

  try {
    const cache = await getProgressCollection(storage.userId, "MANGA", token);
    await setStorage({ mangaProgressCache: cache, mangaProgressCacheUpdatedAt: Date.now() });
    return { cache };
  } catch (err) {
    if (isTokenExpiredError(err)) {
      await handleTokenExpired();
    }
    return { cache: storage.mangaProgressCache ?? {} };
  }
}

function notifyUser(
  tabId: number,
  detection: MediaDetection,
  searchResults: AniListMedia[] | null,
  confirmedMedia?: AniListMedia,
  currentProgress?: number | null
) {
  if (currentProgress === null) currentProgress = 0;

  setTabState(tabId, {
    lastDetection: detection,
    searchResults,
    confirmedMedia: confirmedMedia ?? null,
    currentProgress: currentProgress ?? null,
    lastDetectionUrl: detection.url,
  });

  chrome.action.setBadgeText({ text: "?" });
  chrome.action.setBadgeBackgroundColor({ color: "#3498db" });
}
