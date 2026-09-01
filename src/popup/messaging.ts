import type {
  AliasReportPayload,
  AliasSubmitPayload,
  AniListMedia,
  MediaDetection,
  MediaType,
  UpdateResult,
} from "../types";

async function send<T>(message: unknown): Promise<T | null> {
  try {
    return (await chrome.runtime.sendMessage(message)) as T;
  } catch {
    return null;
  }
}

export function searchAniList(title: string, mediaType: MediaType) {
  return send<{ results: AniListMedia[] }>({
    type: "SEARCH_ANILIST",
    payload: { title, mediaType },
  });
}

export function fetchProgress(mediaId: number) {
  return send<{ progress: number | null }>({
    type: "GET_PROGRESS",
    payload: { mediaId },
  });
}

export function requestUpdate(mediaId: number, progress: number, mediaType: MediaType, tabId: number | null) {
  return send<UpdateResult>({
    type: "UPDATE_PROGRESS",
    payload: { mediaId, progress, mediaType },
    tabId,
  });
}

export function reportAlias(payload: AliasReportPayload) {
  return send<{ success: boolean }>({ type: "ALIAS_REPORT", payload });
}

export function submitAlias(payload: AliasSubmitPayload) {
  return send<void>({ type: "ALIAS_SUBMIT", payload });
}

export function flushPendingUpdates() {
  return send<{ done: boolean }>({ type: "FLUSH_PENDING_UPDATES" });
}

export function startOAuth() {
  return send<{ started: boolean; error?: string }>({ type: "START_OAUTH" });
}

export function notifyDetection(detection: MediaDetection, tabId: number | null) {
  return send<void>({ type: "MEDIA_DETECTED", payload: detection, tabId });
}
