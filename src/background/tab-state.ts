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

export const DEFAULT_TAB_STATE: TabDetectionState = {
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

const TAB_KEY_PREFIX = "tab_";

const writeChains = new Map<number, Promise<void>>();

export function tabKey(tabId: number): string {
  return `${TAB_KEY_PREFIX}${tabId}`;
}

export async function getTabState(tabId: number): Promise<TabDetectionState> {
  const key = tabKey(tabId);
  const result = await chrome.storage.session.get(key);
  return { ...DEFAULT_TAB_STATE, ...(result[key] ?? {}) };
}

export function setTabState(tabId: number, partial: Partial<TabDetectionState>): Promise<void> {
  const previous = writeChains.get(tabId) ?? Promise.resolve();

  const write = async () => {
    const current = await getTabState(tabId);
    await chrome.storage.session.set({ [tabKey(tabId)]: { ...current, ...partial } });
  };

  const next = previous.then(write, write);
  writeChains.set(tabId, next.catch(() => {}));
  return next;
}

export async function removeTabState(tabId: number): Promise<void> {
  writeChains.delete(tabId);
  await chrome.storage.session.remove(tabKey(tabId));
}

export async function pruneTabStates(): Promise<void> {
  const [stored, tabs] = await Promise.all([
    chrome.storage.session.get(null),
    chrome.tabs.query({}),
  ]);

  const alive = new Set(tabs.map((tab) => tab.id).filter((id): id is number => typeof id === "number"));
  const stale = Object.keys(stored).filter((key) => {
    if (!key.startsWith(TAB_KEY_PREFIX)) return false;
    return !alive.has(Number(key.slice(TAB_KEY_PREFIX.length)));
  });

  if (stale.length > 0) {
    await chrome.storage.session.remove(stale);
  }
}
