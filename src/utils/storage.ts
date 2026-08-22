import { DEFAULT_STORAGE, DEFAULT_SESSION, type StorageData, type SessionData, type Theme } from "../types";

export async function getStorage(): Promise<StorageData> {
  const data = await chrome.storage.local.get(DEFAULT_STORAGE);
  return data as StorageData;
}

export async function setStorage(partial: Partial<StorageData>): Promise<void> {
  await chrome.storage.local.set(partial);
}

export async function getSession(): Promise<SessionData> {
  const data = await chrome.storage.session.get(DEFAULT_SESSION);
  return data as SessionData;
}

export async function setSession(partial: Partial<SessionData>): Promise<void> {
  await chrome.storage.session.set(partial);
}

export async function clearSession(): Promise<void> {
  await chrome.storage.session.clear();
}

export async function getToken(): Promise<string | null> {
  const session = await chrome.storage.session.get({ accessToken: null });
  if (session.accessToken) return session.accessToken;
  const local = await chrome.storage.local.get({ accessToken: null });
  if (local.accessToken) {
    await chrome.storage.session.set({ accessToken: local.accessToken });
  }
  return local.accessToken ?? null;
}

export async function setToken(token: string | null): Promise<void> {
  await chrome.storage.local.set({ accessToken: token });
  await chrome.storage.session.set({ accessToken: token });
}

export async function getTitleMapping(siteTitle: string): Promise<number | null> {
  const { titleMappings } = await getStorage();
  return titleMappings[siteTitle] ?? null;
}

export async function saveTitleMapping(siteTitle: string, mediaId: number): Promise<void> {
  const { titleMappings } = await getStorage();
  titleMappings[siteTitle] = mediaId;
  await setStorage({ titleMappings });
}

export async function getTheme(): Promise<Theme> {
  const { theme } = await chrome.storage.local.get({ theme: "dark" });
  return theme as Theme;
}

export async function setTheme(theme: Theme): Promise<void> {
  await chrome.storage.local.set({ theme });
}

export async function removeTitleMapping(title: string): Promise<void> {
  const storage = await getStorage();
  const mappings = { ...storage.titleMappings };
  delete mappings[title];
  await setStorage({ titleMappings: mappings });
  await chrome.storage.session.remove([
    "confirmedMedia",
    "lastDetection",
    "searchResults",
    "currentProgress",
  ]);
}

export async function logoutSelective(): Promise<void> {
  await setStorage({
    accessToken: null,
    userId: null,
    username: null,
    mangaProgressCache: {},
    mangaProgressCacheUpdatedAt: null,
    pendingUpdates: [],
  });
  await clearSession();
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await getToken();
  return token !== null;
}
