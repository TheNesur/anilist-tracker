import {
  DEFAULT_SETTINGS,
  DEFAULT_STORAGE,
  type MediaType,
  type Settings,
  type StorageData,
  type Theme,
} from "../types";

export async function getStorage(): Promise<StorageData> {
  const data = await chrome.storage.local.get(DEFAULT_STORAGE);
  return data as StorageData;
}

export async function setStorage(partial: Partial<StorageData>): Promise<void> {
  await chrome.storage.local.set(partial);
}

export async function getSettings(): Promise<Settings> {
  const data = await chrome.storage.local.get(DEFAULT_SETTINGS);
  return data as Settings;
}

export async function clearSession(): Promise<void> {
  await chrome.storage.session.clear();
}

export async function getToken(): Promise<string | null> {
  const { accessToken } = await chrome.storage.local.get({ accessToken: null });
  return accessToken ?? null;
}

export async function setToken(token: string | null): Promise<void> {
  await chrome.storage.local.set({ accessToken: token, tokenExpired: false });
}

export async function markTokenExpired(): Promise<void> {
  await chrome.storage.local.set({ accessToken: null, tokenExpired: true });
}

export function mappingKey(siteTitle: string, mediaType: MediaType | string): string {
  return `${siteTitle}::${mediaType}`;
}

export interface TitleMappings {
  scoped: Record<string, number>;
  legacy: Record<string, number>;
}

export async function getTitleMappings(): Promise<TitleMappings> {
  const data = await chrome.storage.local.get({ titleMappings: {}, legacyTitleMappings: {} });
  return {
    scoped: data.titleMappings as Record<string, number>,
    legacy: data.legacyTitleMappings as Record<string, number>,
  };
}

let mappingWriteChain: Promise<void> = Promise.resolve();

function queueMappingWrite(task: () => Promise<void>): Promise<void> {
  const next = mappingWriteChain.then(task, task);
  mappingWriteChain = next.catch(() => {});
  return next;
}

export function saveTitleMapping(siteTitle: string, mediaType: MediaType | string, mediaId: number): Promise<void> {
  return queueMappingWrite(async () => {
    const { scoped } = await getTitleMappings();
    scoped[mappingKey(siteTitle, mediaType)] = mediaId;
    await setStorage({ titleMappings: scoped });
  });
}

export function removeTitleMapping(key: string): Promise<void> {
  return queueMappingWrite(async () => {
    const { scoped } = await getTitleMappings();
    delete scoped[key];
    await setStorage({ titleMappings: scoped });
  });
}

export function dropLegacyMapping(siteTitle: string): Promise<void> {
  return queueMappingWrite(async () => {
    const { legacy } = await getTitleMappings();
    if (!(siteTitle in legacy)) return;
    delete legacy[siteTitle];
    await setStorage({ legacyTitleMappings: legacy });
  });
}

export async function getTheme(): Promise<Theme> {
  const { theme } = await chrome.storage.local.get({ theme: "dark" });
  return theme as Theme;
}

export async function setTheme(theme: Theme): Promise<void> {
  await chrome.storage.local.set({ theme });
}

export async function logoutSelective(): Promise<void> {
  await setStorage({
    accessToken: null,
    userId: null,
    username: null,
    tokenExpired: false,
    mangaProgressCache: {},
    mangaProgressCacheUpdatedAt: null,
    pendingUpdates: [],
  });
  await clearSession();
}
