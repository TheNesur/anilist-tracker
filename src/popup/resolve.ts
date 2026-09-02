import { getSiteForHostname } from "../sites/registry";
import type { MediaDetection, MediaType, GenericDetectionResult, PopupState } from "../types";
import { tryGenericDetection } from "./generic-detect";
import { notifyDetection } from "./messaging";
import { renderState } from "./render";
import {
  getActiveTabId,
  isRefreshSuppressed,
  readTabState,
  setActiveTabId,
  setCurrentDetection,
  setSelectedMedia,
} from "./state";

const RESOLVE_DEBOUNCE_MS = 80;

let running = false;
let rerunRequested = false;
let hasRendered = false;
let debounceTimer: number | null = null;

const SYSTEM_PREFIXES = ["chrome://", "edge://", "about:", "chrome-extension://", "extension://"];

export function scheduleResolve(): void {
  if (debounceTimer !== null) window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    debounceTimer = null;
    resolveState();
  }, RESOLVE_DEBOUNCE_MS);
}

export function scheduleResolveIfAllowed(): void {
  if (isRefreshSuppressed()) return;
  scheduleResolve();
}

export async function resolveState(): Promise<void> {
  if (running) {
    rerunRequested = true;
    return;
  }

  running = true;
  try {
    do {
      rerunRequested = false;
      const state = await computeState();
      renderState(state);
      hasRendered = true;
    } while (rerunRequested);
  } finally {
    running = false;
  }
}

export function proceedWithGenericDetection(candidate: GenericDetectionResult, mediaType: MediaType): void {
  const detection: MediaDetection = {
    title: candidate.title,
    progress: candidate.progress,
    mediaType,
    source: "generic",
    url: candidate.url,
  };
  renderState({ type: "loading" });
  notifyDetection(detection, getActiveTabId());
}

async function computeState(): Promise<PopupState> {
  if (!hasRendered) renderState({ type: "loading" });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url;
  setActiveTabId(tab?.id ?? null);

  if (!url || SYSTEM_PREFIXES.some((prefix) => url.startsWith(prefix))) {
    return { type: "unsupported_site", hostname: "system page" };
  }

  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return { type: "unsupported_site", hostname: "unknown" };
  }

  const { tokenExpired } = await chrome.storage.local.get({ tokenExpired: false });
  if (tokenExpired) {
    return { type: "token_expired" };
  }

  const session = await readTabState();
  const site = getSiteForHostname(hostname)?.id ?? null;
  const isCurrentPage = Boolean(session.lastDetectionUrl && session.lastDetectionUrl === url);
  const isManualMatch = Boolean(session.confirmedMediaManual);

  if (session.apiError && isCurrentPage) {
    return { type: "error", message: session.apiError };
  }

  if (session.detectionSearching && isCurrentPage) {
    return { type: "searching", preview: session.detectionSearchingPreview ?? null };
  }

  if (session.lastDetection && isCurrentPage) {
    setCurrentDetection(session.lastDetection);
    setSelectedMedia(session.confirmedMedia ?? null);
    return {
      type: "detected",
      detection: session.lastDetection,
      progress: session.currentProgress ?? null,
      media: session.confirmedMedia ?? null,
      searchResults: session.confirmedMedia ? null : (session.searchResults ?? null),
      isManualMatch,
    };
  }

  if (!site) {
    const candidate = tab?.id ? await tryGenericDetection(tab.id) : null;

    if (candidate) {
      if (candidate.possibleTypes.length === 1) {
        proceedWithGenericDetection(candidate, candidate.possibleTypes[0]);
        return { type: "loading" };
      }
      return { type: "generic_type_pick", candidate, hostname };
    }

    return { type: "unsupported_site", hostname };
  }

  if (session.detectionFailed && isCurrentPage) {
    return { type: "detection_failed", site };
  }

  return { type: "unsupported_page", site };
}
