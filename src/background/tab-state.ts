import type { AniListMedia, MediaDetection, MediaType } from "../types";

export interface TabDetectionState {
  lastDetection: MediaDetection | null;
  lastDetectionUrl: string | null;
  searchResults: AniListMedia[] | null;
  confirmedMedia: AniListMedia | null;
  confirmedMediaManual: boolean;
  currentProgress: number | null;
  detectionFailed: boolean;
  detectionSearching: boolean;
  detectionSearchingPreview: { title: string; progress: number; mediaType: MediaType } | null;
  apiError: string | null;
}

const DEFAULT_TAB_STATE: TabDetectionState = {
  lastDetection: null,
  lastDetectionUrl: null,
  searchResults: null,
  confirmedMedia: null,
  confirmedMediaManual: false,
  currentProgress: null,
  detectionFailed: false,
  detectionSearching: false,
  detectionSearchingPreview: null,
  apiError: null,
};

export function tabKey(tabId: number): string {
  return `tab_${tabId}`;
}

export async function getTabState(tabId: number): Promise<TabDetectionState> {
  const key = tabKey(tabId);
  const result = await chrome.storage.session.get(key);
  return result[key] ?? { ...DEFAULT_TAB_STATE };
}

export async function setTabState(tabId: number, partial: Partial<TabDetectionState>): Promise<void> {
  const key = tabKey(tabId);
  const current = await getTabState(tabId);
  await chrome.storage.session.set({ [key]: { ...current, ...partial } });
}

export async function removeTabState(tabId: number): Promise<void> {
  await chrome.storage.session.remove(tabKey(tabId));
}
