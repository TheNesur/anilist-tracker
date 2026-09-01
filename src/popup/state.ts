import type { AniListMedia, MediaDetection } from "../types";
import type { TabDetectionState } from "../background/tab-state";

const REFRESH_SUPPRESSION_MS = 600;

let activeTabId: number | null = null;
let currentDetection: MediaDetection | null = null;
let selectedMedia: AniListMedia | null = null;
let suppressUntil = 0;
let refreshHandler: () => void = () => {};

export function setActiveTabId(id: number | null): void {
  activeTabId = id;
}

export function getActiveTabId(): number | null {
  return activeTabId;
}

export function setCurrentDetection(detection: MediaDetection | null): void {
  currentDetection = detection;
}

export function getCurrentDetection(): MediaDetection | null {
  return currentDetection;
}

export function setSelectedMedia(media: AniListMedia | null): void {
  selectedMedia = media;
}

export function getSelectedMedia(): AniListMedia | null {
  return selectedMedia;
}

export function setRefreshHandler(handler: () => void): void {
  refreshHandler = handler;
}

export function requestRefresh(): void {
  refreshHandler();
}

export function suppressRefresh(ms = REFRESH_SUPPRESSION_MS): void {
  suppressUntil = Math.max(suppressUntil, Date.now() + ms);
}

export function isRefreshSuppressed(): boolean {
  return Date.now() < suppressUntil;
}

export function tabStateKey(): string | null {
  return activeTabId === null ? null : `tab_${activeTabId}`;
}

export async function readTabState(): Promise<Partial<TabDetectionState>> {
  const key = tabStateKey();
  if (!key) return {};
  const result = await chrome.storage.session.get(key);
  return (result[key] as Partial<TabDetectionState>) ?? {};
}

export async function updateTabState(partial: Partial<TabDetectionState>): Promise<void> {
  const key = tabStateKey();
  if (!key) return;
  suppressRefresh();
  const current = await readTabState();
  await chrome.storage.session.set({ [key]: { ...current, ...partial } });
}
