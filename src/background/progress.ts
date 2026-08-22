import { getProgress, updateProgress, saveProgressBatch } from "../utils/anilist";
import { getToken, getStorage, setStorage } from "../utils/storage";
import { isTokenExpiredError, isAniListUnreachableError, type MediaDetection, type PendingUpdate } from "../types";
import { scheduleBadgeClear, updatePendingBadge } from "./badge";
import { ensureViewerLoaded, handleTokenExpired } from "./oauth";

const PENDING_RETRY_ALARM = "anilist-tracker:retry-pending";
const PENDING_RETRY_INTERVAL_MIN = 5;
const BATCH_CHUNK_SIZE = 25;

let flushing = false;

export function isPendingRetryAlarm(name: string): boolean {
  return name === PENDING_RETRY_ALARM;
}

export async function handleUpdate(
  mediaId: number,
  progress: number,
  mediaType: MediaDetection["mediaType"] = "MANGA"
) {
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

    return { success: true, progress: result.progress };
  } catch (err) {
    if (isTokenExpiredError(err)) {
      await handleTokenExpired();
      return { success: false, error: "Token expired" };
    }
    if (isAniListUnreachableError(err)) {
      await queuePendingUpdate(mediaId, progress, mediaType);
      return { success: true, queued: true };
    }
    console.error("[AniList Tracker] Update failed:", err instanceof Error ? err.message : "unknown");
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function ensureRetryAlarmScheduled() {
  const existing = await chrome.alarms.get(PENDING_RETRY_ALARM);
  if (!existing) {
    chrome.alarms.create(PENDING_RETRY_ALARM, { periodInMinutes: PENDING_RETRY_INTERVAL_MIN });
  }
}

async function queuePendingUpdate(
  mediaId: number,
  progress: number,
  mediaType: MediaDetection["mediaType"]
) {
  const storage = await getStorage();
  const pending = [...storage.pendingUpdates];
  const existingIndex = pending.findIndex(
    (p) => p.mediaId === mediaId && p.mediaType === mediaType
  );

  if (existingIndex !== -1) {
    if (pending[existingIndex].progress < progress) {
      pending[existingIndex] = { mediaId, progress, mediaType, queuedAt: Date.now() };
    }
  } else {
    pending.push({ mediaId, progress, mediaType, queuedAt: Date.now() });
  }

  await setStorage({ pendingUpdates: pending });
  updatePendingBadge(pending.length);
  await ensureRetryAlarmScheduled();
}

export async function flushPendingUpdates() {
  if (flushing) return;
  flushing = true;

  try {
    const storage = await getStorage();
    if (storage.pendingUpdates.length === 0) {
      chrome.alarms.clear(PENDING_RETRY_ALARM);
      return;
    }

    const token = await getToken();
    if (!token) return;

    const queue = storage.pendingUpdates;
    const remaining: PendingUpdate[] = [];
    let droppedCount = 0;

    for (let i = 0; i < queue.length; i += BATCH_CHUNK_SIZE) {
      const chunk = queue.slice(i, i + BATCH_CHUNK_SIZE);

      try {
        const results = await saveProgressBatch(
          chunk.map((p) => ({ mediaId: p.mediaId, progress: p.progress })),
          token
        );

        results.forEach((result, idx) => {
          if (!result.success) {
            droppedCount++;
            console.error("[AniList Tracker] Pending update dropped:", chunk[idx].mediaId, result.error);
          }
        });
      } catch (err) {
        if (isTokenExpiredError(err)) {
          await handleTokenExpired();
          remaining.push(...queue.slice(i));
          break;
        }
        if (isAniListUnreachableError(err)) {
          remaining.push(...queue.slice(i));
          break;
        }
        remaining.push(...chunk);
      }
    }

    await setStorage({ pendingUpdates: remaining });
    updatePendingBadge(remaining.length);

    if (remaining.length === 0) {
      chrome.alarms.clear(PENDING_RETRY_ALARM);
    }

    if (droppedCount > 0) {
      await chrome.storage.session.set({ pendingUpdateErrorCount: droppedCount });
    }
  } finally {
    flushing = false;
  }
}
