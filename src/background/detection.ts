import { errMsg } from "../utils/dom";
import { searchManga, searchAnime, getProgress, getProgressCollection } from "../utils/anilist";
import {
  dropLegacyMapping,
  getSettings,
  getStorage,
  getTitleMappings,
  getToken,
  mappingKey,
  saveTitleMapping,
  setStorage,
} from "../utils/storage";
import { findExactMatch } from "../utils/matching";
import { isTokenExpiredError, type AniListMedia, type MediaDetection, type MediaType } from "../types";
import { normalizeSearchTitle } from "../parsers/utils";
import { lookupAlias } from "./alias";
import { handleUpdate } from "./progress";
import { migrationsReady } from "./migrations";
import { primeMedia, resolveMedia } from "./media-cache";
import { ensureViewerLoaded, handleTokenExpired } from "./oauth";
import { clearTabBadge, setTabBadge } from "./badge";
import { setTabState } from "./tab-state";

const PROGRESS_CACHE_TTL_MS = 15 * 60 * 1000;

const inFlight = new Map<number, string>();

function detectionKey(detection: MediaDetection): string {
  return `${detection.url}|${detection.mediaType}|${detection.progress}`;
}

export async function handleDetection(detection: MediaDetection, tabId: number): Promise<void> {
  const key = detectionKey(detection);
  if (inFlight.get(tabId) === key) return;
  inFlight.set(tabId, key);

  try {
    await migrationsReady;
    await runDetection(detection, tabId);
  } catch (err) {
    console.error("[AniList Tracker] Detection crashed:", errMsg(err));
  } finally {
    if (inFlight.get(tabId) === key) inFlight.delete(tabId);
  }
}

async function resolveFromLegacyMapping(
  detection: MediaDetection,
  legacy: Record<string, number>
): Promise<number | null> {
  const legacyId = legacy[detection.title];
  if (legacyId === undefined) return null;

  const media = await resolveMedia(legacyId);

  if (media && (media.type === undefined || media.type === detection.mediaType)) {
    await saveTitleMapping(detection.title, detection.mediaType, legacyId);
    await dropLegacyMapping(detection.title);
    return legacyId;
  }

  await dropLegacyMapping(detection.title);
  return null;
}

async function runDetection(detection: MediaDetection, tabId: number): Promise<void> {
  await setTabState(tabId, {
    lastDetectionUrl: detection.url,
    lastDetection: null,
    confirmedMedia: null,
    confirmedMediaManual: false,
    searchResults: null,
    currentProgress: null,
    apiError: null,
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
    setTabBadge(tabId, "!", "#e74c3c");
    await setTabState(tabId, { detectionSearching: false });
    return;
  }

  const settings = await getSettings();

  try {
    const { scoped, legacy } = await getTitleMappings();
    let mediaId: number | null = scoped[mappingKey(detection.title, detection.mediaType)] ?? null;

    if (mediaId === null) {
      mediaId = await resolveFromLegacyMapping(detection, legacy);
    }

    if (mediaId === null) {
      const searchTitle = normalizeSearchTitle(detection.title);
      const results = detection.mediaType === "ANIME"
        ? await searchAnime(searchTitle)
        : await searchManga(searchTitle);

      if (results.length === 0) {
        const alias = await lookupAlias(detection.title, detection.mediaType);
        if (alias) {
          const media = await resolveMedia(alias.mediaId);
          if (media) {
            await saveTitleMapping(detection.title, detection.mediaType, media.id);
            mediaId = media.id;
          }
        }

        if (mediaId === null) {
          await notifyUser(tabId, detection, []);
          return;
        }
      } else {
        if (settings.autoMap) {
          const exactMatch = findExactMatch(detection.title, results);
          if (exactMatch) {
            await saveTitleMapping(detection.title, detection.mediaType, exactMatch.id);
            await primeMedia(exactMatch);
            mediaId = exactMatch.id;
          }
        }

        if (mediaId === null) {
          await notifyUser(tabId, detection, results);
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

    const shouldUpdate =
      settings.autoUpdate && (currentProgress === null || detection.progress > currentProgress);

    if (shouldUpdate) {
      const result = await handleUpdate(mediaId, detection.progress, detection.mediaType, {
        tabId,
        knownProgress: currentProgress,
      });
      const media = await resolveMedia(mediaId);
      if (media) {
        const newProgress = result.progress ?? detection.progress;
        await notifyUser(tabId, detection, null, media, newProgress, result.success !== false);
      } else {
        await setTabState(tabId, { detectionSearching: false });
      }
      return;
    }

    const media = await resolveMedia(mediaId);
    if (media) {
      await notifyUser(tabId, detection, null, media, currentProgress);
    } else {
      console.error("[AniList Tracker] Media not found by id", mediaId);
      await setTabState(tabId, { detectionSearching: false });
    }
  } catch (err) {
    if (isTokenExpiredError(err)) {
      await handleTokenExpired(tabId);
    } else {
      console.error("[AniList Tracker] Detection handling failed:", errMsg(err));
      await setTabState(tabId, {
        apiError: errMsg(err),
        lastDetectionUrl: detection.url,
      });
    }
    await setTabState(tabId, { detectionSearching: false });
  }
}

export async function handleGetProgressCache(mediaType: MediaType) {
  if (mediaType !== "MANGA") {
    return { cache: {}, authed: false };
  }

  const token = await getToken();
  const storage = await getStorage();
  if (!token || !storage.userId) {
    return { cache: {}, authed: false };
  }

  const isStale =
    !storage.mangaProgressCacheUpdatedAt ||
    Date.now() - storage.mangaProgressCacheUpdatedAt > PROGRESS_CACHE_TTL_MS;

  if (!isStale) {
    return { cache: storage.mangaProgressCache, authed: true };
  }

  try {
    const cache = await getProgressCollection(storage.userId, "MANGA", token);
    await setStorage({ mangaProgressCache: cache, mangaProgressCacheUpdatedAt: Date.now() });
    return { cache, authed: true };
  } catch (err) {
    if (isTokenExpiredError(err)) {
      await handleTokenExpired();
    }
    return { cache: storage.mangaProgressCache ?? {}, authed: true };
  }
}

async function notifyUser(
  tabId: number,
  detection: MediaDetection,
  searchResults: AniListMedia[] | null,
  confirmedMedia?: AniListMedia,
  currentProgress?: number | null,
  updated = false
): Promise<void> {
  await setTabState(tabId, {
    lastDetection: detection,
    searchResults,
    confirmedMedia: confirmedMedia ?? null,
    confirmedMediaManual: false,
    currentProgress: currentProgress ?? null,
    lastDetectionUrl: detection.url,
    detectionSearching: false,
    detectionSearchingPreview: null,
  });

  if (updated) return;

  if (confirmedMedia && currentProgress !== null && currentProgress !== undefined && detection.progress <= currentProgress) {
    clearTabBadge(tabId);
    return;
  }

  setTabBadge(tabId, "?", "#3498db");
}
