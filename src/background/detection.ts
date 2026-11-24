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
import {
  isAniListUnreachableError,
  isTokenExpiredError,
  type AniListMedia,
  type MediaDetection,
  type MediaType,
} from "../types";
import { normalizeSearchTitle } from "../parsers/utils";
import { lookupAlias } from "./alias";
import { handleUpdate, queuePendingUpdate } from "./progress";
import { migrationsReady } from "./migrations";
import { primeMedia, resolveMedia } from "./media-cache";
import { resolveAnimeSeason } from "./season-resolver";
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
  legacy: Record<string, number>,
  token: string
): Promise<number | null> {
  const legacyId = legacy[detection.title];
  if (legacyId === undefined) return null;

  const media = await resolveMedia(legacyId, token);

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
      mediaId = await resolveFromLegacyMapping(detection, legacy, token);
    }

    if (mediaId === null) {
      const results = detection.mediaType === "ANIME"
        ? await searchAnime(detection.title, token)
        : await searchManga(detection.title, token);

      if (results.length === 0) {
        const alias = await lookupAlias(detection.title, detection.mediaType);
        if (alias) {
          const media = await resolveMedia(alias.mediaId, token);
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

    let effectiveDetection = detection;
    let resolvedMedia: AniListMedia | null = null;

    if (detection.mediaType === "ANIME") {
      const seasonResolved = await resolveAnimeSeason(
        mediaId,
        detection.progress,
        detection.title,
        token
      );
      if (seasonResolved) {
        mediaId = seasonResolved.media.id;
        resolvedMedia = seasonResolved.media;
        effectiveDetection = { ...detection, progress: seasonResolved.progress };
      }
    }

    let userId: number | null = null;
    let currentProgress: number | null = null;
    let progressUnknown = false;

    try {
      userId = await ensureViewerLoaded(token);
    } catch (err) {
      if (!isAniListUnreachableError(err)) throw err;
      progressUnknown = true;
    }

    if (!progressUnknown) {
      if (userId === null) {
        progressUnknown = true;
      } else {
        try {
          const entry = await getProgress(mediaId, userId, token);
          currentProgress = entry?.progress ?? null;
        } catch (err) {
          if (!isAniListUnreachableError(err)) throw err;
          progressUnknown = true;
        }
      }
    }

    if (settings.autoUpdate && progressUnknown) {
      await queuePendingUpdate(mediaId, effectiveDetection.progress, effectiveDetection.mediaType, tabId);
      const queuedMedia = resolvedMedia ?? (await resolveMedia(mediaId, token));
      await notifyUser(tabId, effectiveDetection, null, queuedMedia ?? undefined, null, "queued");
      return;
    }

    const shouldUpdate =
      settings.autoUpdate && (currentProgress === null || effectiveDetection.progress > currentProgress);

    if (shouldUpdate) {
      const result = await handleUpdate(mediaId, effectiveDetection.progress, effectiveDetection.mediaType, {
        tabId,
        knownProgress: currentProgress,
      });
      const media = resolvedMedia ?? (await resolveMedia(mediaId, token));

      if (result.queued) {
        await notifyUser(tabId, effectiveDetection, null, media ?? undefined, currentProgress, "queued");
        return;
      }

      if (media) {
        const newProgress = result.success === false
          ? currentProgress
          : result.progress ?? effectiveDetection.progress;
        await notifyUser(
          tabId,
          effectiveDetection,
          null,
          media,
          newProgress,
          result.success === false ? "failed" : "updated"
        );
      } else {
        await setTabState(tabId, { detectionSearching: false });
      }
      return;
    }

    const media = resolvedMedia ?? (await resolveMedia(mediaId, token));
    if (media) {
      await notifyUser(tabId, effectiveDetection, null, media, currentProgress);
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

type NotifyOutcome = "none" | "updated" | "queued" | "failed";

async function notifyUser(
  tabId: number,
  detection: MediaDetection,
  searchResults: AniListMedia[] | null,
  confirmedMedia?: AniListMedia,
  currentProgress?: number | null,
  outcome: NotifyOutcome = "none"
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

  if (outcome === "updated" || outcome === "queued") return;

  if (outcome === "failed") {
    setTabBadge(tabId, "!", "#e74c3c");
    return;
  }

  if (confirmedMedia && currentProgress !== null && currentProgress !== undefined && detection.progress <= currentProgress) {
    clearTabBadge(tabId);
    return;
  }

  setTabBadge(tabId, "?", "#3498db");
}
