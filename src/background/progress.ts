import { errMsg } from "../utils/dom";
import { getProgress, updateProgress, saveProgressBatch, getProgressCollection } from "../utils/anilist";
import { clearBlock } from "../utils/request-queue";
import { getToken, getStorage, setStorage } from "../utils/storage";
import {
  isTokenExpiredError,
  isAniListUnreachableError,
  type MediaType,
  type PendingUpdate,
  type UpdateResult,
} from "../types";
import { clearTabBadge, scheduleBadgeClear, setTabBadge, updatePendingBadge } from "./badge";
import { ensureViewerLoaded, handleTokenExpired } from "./oauth";

const PENDING_RETRY_ALARM = "anilist-tracker:retry-pending";
const RETRY_MIN_MINUTES = 5;
const RETRY_MAX_MINUTES = 60;
const RETRY_BACKOFF_FACTOR = 2;
const PENDING_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_PENDING = 50;
const BATCH_CHUNK_SIZE = 25;

let flushing = false;

export interface UpdateOptions {
  tabId?: number;
  knownProgress?: number | null;
}

export function isPendingRetryAlarm(name: string): boolean {
  return name === PENDING_RETRY_ALARM;
}

export async function handleUpdate(
  mediaId: number,
  progress: number,
  mediaType: MediaType = "MANGA",
  options: UpdateOptions = {}
): Promise<UpdateResult> {
  const token = await getToken();
  if (!token) return { success: false, error: "Not authenticated" };

  try {
    const userId = await ensureViewerLoaded(token);
    if (!userId) return { success: false, error: "No user ID" };

    const current = options.knownProgress !== undefined
      ? options.knownProgress
      : (await getProgress(mediaId, userId, token))?.progress ?? null;

    if (current !== null && current >= progress) {
      return { success: true, skipped: true, current };
    }

    const result = await updateProgress(mediaId, progress, token);

    if (options.tabId !== undefined) {
      setTabBadge(options.tabId, "\u2713", "#2ecc71");
      scheduleBadgeClear(options.tabId);
    }

    return { success: true, progress: result.progress };
  } catch (err) {
    if (isTokenExpiredError(err)) {
      await handleTokenExpired(options.tabId);
      return { success: false, error: "Token expired" };
    }
    if (isAniListUnreachableError(err)) {
      await queuePendingUpdate(mediaId, progress, mediaType, options.tabId);
      return { success: true, queued: true };
    }
    console.error("[AniList Tracker] Update failed:", errMsg(err));
    return { success: false, error: errMsg(err) };
  }
}

async function scheduleRetry(minutes: number): Promise<void> {
  const clamped = Math.min(Math.max(minutes, RETRY_MIN_MINUTES), RETRY_MAX_MINUTES);
  await setStorage({ pendingRetryMinutes: clamped });
  chrome.alarms.create(PENDING_RETRY_ALARM, {
    delayInMinutes: clamped,
    periodInMinutes: clamped,
  });
}

async function clearRetry(): Promise<void> {
  await chrome.alarms.clear(PENDING_RETRY_ALARM);
  await setStorage({ pendingRetryMinutes: RETRY_MIN_MINUTES });
}

function prunePending(queue: PendingUpdate[]): PendingUpdate[] {
  const cutoff = Date.now() - PENDING_TTL_MS;
  const fresh = queue.filter((entry) => entry.queuedAt >= cutoff);
  return fresh.length > MAX_PENDING ? fresh.slice(fresh.length - MAX_PENDING) : fresh;
}

export async function queuePendingUpdate(
  mediaId: number,
  progress: number,
  mediaType: MediaType,
  tabId?: number
): Promise<void> {
  const storage = await getStorage();
  const pending = prunePending([...storage.pendingUpdates]);
  const existingIndex = pending.findIndex(
    (p) => p.mediaId === mediaId && p.mediaType === mediaType
  );

  if (existingIndex !== -1) {
    if (pending[existingIndex].progress < progress) {
      pending[existingIndex] = {
        ...pending[existingIndex],
        progress,
        queuedAt: pending[existingIndex].queuedAt ?? Date.now(),
      };
    }
  } else {
    pending.push({ mediaId, progress, mediaType, queuedAt: Date.now(), attempts: 0 });
  }

  const capped = prunePending(pending);
  await setStorage({ pendingUpdates: capped });

  if (tabId !== undefined) {
    clearTabBadge(tabId);
  }
  updatePendingBadge(capped.length);

  const existingAlarm = await chrome.alarms.get(PENDING_RETRY_ALARM);
  if (!existingAlarm) {
    await scheduleRetry(storage.pendingRetryMinutes || RETRY_MIN_MINUTES);
  }
}

async function dropAlreadySyncedEntries(
  queue: PendingUpdate[],
  userId: number,
  token: string
): Promise<{ keep: PendingUpdate[]; skipped: number }> {
  const types = Array.from(new Set(queue.map((entry) => entry.mediaType)));
  const known = new Map<MediaType, Record<number, number>>();

  for (const type of types) {
    known.set(type, await getProgressCollection(userId, type, token));
  }

  const keep: PendingUpdate[] = [];
  let skipped = 0;

  for (const entry of queue) {
    const current = known.get(entry.mediaType)?.[entry.mediaId];
    if (current !== undefined && current >= entry.progress) {
      skipped++;
      continue;
    }
    keep.push(entry);
  }

  return { keep, skipped };
}

export async function flushPendingUpdates(options: { force?: boolean } = {}): Promise<void> {
  if (flushing) return;
  flushing = true;

  try {
    if (options.force) {
      clearBlock();
    }

    const storage = await getStorage();
    const queue = prunePending(storage.pendingUpdates);

    if (queue.length !== storage.pendingUpdates.length) {
      await setStorage({ pendingUpdates: queue });
    }

    if (queue.length === 0) {
      await clearRetry();
      updatePendingBadge(0);
      return;
    }

    const token = await getToken();
    if (!token) return;

    let userId: number | null = null;
    try {
      userId = await ensureViewerLoaded(token);
    } catch (err) {
      if (!isAniListUnreachableError(err)) throw err;
      await scheduleRetry((storage.pendingRetryMinutes || RETRY_MIN_MINUTES) * RETRY_BACKOFF_FACTOR);
      return;
    }

    if (userId === null) {
      await scheduleRetry((storage.pendingRetryMinutes || RETRY_MIN_MINUTES) * RETRY_BACKOFF_FACTOR);
      return;
    }

    let coherent: PendingUpdate[];
    try {
      const checked = await dropAlreadySyncedEntries(queue, userId, token);
      coherent = checked.keep;
      if (checked.skipped > 0) {
        await setStorage({ pendingUpdates: coherent });
        updatePendingBadge(coherent.length);
      }
    } catch (err) {
      if (isTokenExpiredError(err)) {
        await handleTokenExpired();
        return;
      }
      if (!isAniListUnreachableError(err)) throw err;
      await scheduleRetry((storage.pendingRetryMinutes || RETRY_MIN_MINUTES) * RETRY_BACKOFF_FACTOR);
      return;
    }

    if (coherent.length === 0) {
      await setStorage({ pendingUpdates: [] });
      updatePendingBadge(0);
      await clearRetry();
      return;
    }

    const remaining: PendingUpdate[] = [];
    const dropped: string[] = [];
    let deferred = false;

    for (let i = 0; i < coherent.length; i += BATCH_CHUNK_SIZE) {
      const chunk = coherent.slice(i, i + BATCH_CHUNK_SIZE);

      if (deferred) {
        remaining.push(...chunk);
        continue;
      }

      try {
        const results = await saveProgressBatch(
          chunk.map((p) => ({ mediaId: p.mediaId, progress: p.progress })),
          token
        );

        results.forEach((result, idx) => {
          if (result.success) return;
          dropped.push(`${chunk[idx].mediaId}: ${result.error ?? "Unknown error"}`);
        });
      } catch (err) {
        if (isTokenExpiredError(err)) {
          await handleTokenExpired();
          remaining.push(...coherent.slice(i));
          deferred = true;
          break;
        }
        if (isAniListUnreachableError(err)) {
          remaining.push(...chunk.map((entry) => ({
            ...entry,
            attempts: (entry.attempts ?? 0) + 1,
          })));
          deferred = true;
          continue;
        }
        console.error("[AniList Tracker] Pending flush failed:", errMsg(err));
        remaining.push(...chunk.map((entry) => ({
          ...entry,
          attempts: (entry.attempts ?? 0) + 1,
        })));
        deferred = true;
      }
    }

    await setStorage({ pendingUpdates: remaining });
    updatePendingBadge(remaining.length);

    if (remaining.length === 0) {
      await clearRetry();
    } else if (deferred) {
      const current = storage.pendingRetryMinutes || RETRY_MIN_MINUTES;
      await scheduleRetry(current * RETRY_BACKOFF_FACTOR);
    } else {
      await scheduleRetry(RETRY_MIN_MINUTES);
    }

    if (dropped.length > 0) {
      console.error("[AniList Tracker] Pending updates dropped:", dropped.join(" | "));
      await chrome.storage.session.set({ pendingUpdateErrorCount: dropped.length });
    }
  } finally {
    flushing = false;
  }
}

export async function resumePendingRetry(): Promise<void> {
  const storage = await getStorage();
  const queue = prunePending(storage.pendingUpdates);

  if (queue.length !== storage.pendingUpdates.length) {
    await setStorage({ pendingUpdates: queue });
  }

  updatePendingBadge(queue.length);

  if (queue.length === 0) {
    await clearRetry();
    return;
  }

  const existing = await chrome.alarms.get(PENDING_RETRY_ALARM);
  if (!existing) {
    await scheduleRetry(storage.pendingRetryMinutes || RETRY_MIN_MINUTES);
  }
}
