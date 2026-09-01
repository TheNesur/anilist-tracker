import { getMediaById } from "../utils/anilist";
import type { AniListMedia } from "../types";

const CACHE_KEY = "mediaCache";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 300;

interface CacheEntry {
  media: AniListMedia;
  at: number;
}

type Cache = Record<string, CacheEntry>;

let writeChain: Promise<void> = Promise.resolve();

async function readCache(): Promise<Cache> {
  const data = await chrome.storage.local.get({ [CACHE_KEY]: {} });
  return data[CACHE_KEY] as Cache;
}

function queueWrite(task: () => Promise<void>): Promise<void> {
  const next = writeChain.then(task, task);
  writeChain = next.catch(() => {});
  return next;
}

function storeMedia(id: number, media: AniListMedia): Promise<void> {
  return queueWrite(async () => {
    const cache = await readCache();
    cache[String(id)] = { media, at: Date.now() };

    const keys = Object.keys(cache);
    if (keys.length > MAX_ENTRIES) {
      keys
        .sort((a, b) => cache[a].at - cache[b].at)
        .slice(0, keys.length - MAX_ENTRIES)
        .forEach((key) => delete cache[key]);
    }

    await chrome.storage.local.set({ [CACHE_KEY]: cache });
  });
}

export async function resolveMedia(id: number): Promise<AniListMedia | null> {
  const cache = await readCache();
  const entry = cache[String(id)];

  if (entry && Date.now() - entry.at < TTL_MS) {
    return entry.media;
  }

  const media = await getMediaById(id);
  if (media) {
    await storeMedia(id, media);
    return media;
  }

  return entry?.media ?? null;
}

export async function primeMedia(media: AniListMedia): Promise<void> {
  await storeMedia(media.id, media);
}
