import { DEFAULT_STORAGE, type StorageData, type Theme } from "../types";

export async function getStorage(): Promise<StorageData> {
  const data = await chrome.storage.local.get(DEFAULT_STORAGE);
  return data as StorageData;
}

export async function setStorage(
  partial: Partial<StorageData>
): Promise<void> {
  await chrome.storage.local.set(partial);
}

export async function getToken(): Promise<string | null> {
  const { accessToken } = await getStorage();
  return accessToken;
}

export async function getTitleMapping(
  siteTitle: string
): Promise<number | null> {
  const { titleMappings } = await getStorage();
  return titleMappings[siteTitle] ?? null;
}

export async function saveTitleMapping(
  siteTitle: string,
  mediaId: number
): Promise<void> {
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
  await chrome.storage.session.set({ confirmedMediaId: null });
}