import { DEFAULT_STORAGE, type StorageData } from "../types";

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
