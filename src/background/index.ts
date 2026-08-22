import { searchManga, searchAnime, getProgress } from "../utils/anilist";
import { getStorage, getToken, setSession } from "../utils/storage";
import { isTokenExpiredError, type MediaDetection, type AliasSubmitPayload } from "../types";
import { normalizeSearchTitle } from "../parsers/utils";
import { handleDetection, handleGetProgressCache } from "./detection";
import { handleUpdate, flushPendingUpdates, isPendingRetryAlarm } from "./progress";
import { startOAuth, handleTokenExpired, ensureViewerLoaded } from "./oauth";
import { submitAlias } from "./alias";
import { isBadgeClearAlarm, updatePendingBadge } from "./badge";

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "update") {
    (async () => {
      const storage = await getStorage();
      if (storage.showUpdatePage) {
        chrome.tabs.create({ url: chrome.runtime.getURL("update.html") });
      } else {
        chrome.action.setBadgeText({ text: "★" });
        chrome.action.setBadgeBackgroundColor({ color: "#3db4f2" });
      }
    })();
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (isBadgeClearAlarm(alarm.name)) {
    (async () => {
      const storage = await getStorage();
      updatePendingBadge(storage.pendingUpdates.length);
    })();
  }

  if (isPendingRetryAlarm(alarm.name)) {
    flushPendingUpdates();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return;

  const { type, payload } = message as { type: string; payload?: unknown };

  switch (type) {
    case "MEDIA_DETECTED":
      handleDetection(payload as MediaDetection);
      return;

    case "UPDATE_PROGRESS": {
      const p = payload as { mediaId: number; progress: number; mediaType: MediaDetection["mediaType"] };
      handleUpdate(p.mediaId, p.progress, p.mediaType).then(sendResponse);
      return true;
    }

    case "LOCAL_UPDATE_PROGRESS": {
      const p = payload as { progress: number } | undefined;
      if (!p || typeof p.progress !== "number" || p.progress < 0 || !Number.isFinite(p.progress)) return;
      (async () => {
        const session = await chrome.storage.session.get("lastDetection");
        if (!session.lastDetection) return;
        await chrome.storage.session.set({
          lastDetection: { ...session.lastDetection as MediaDetection, progress: p.progress },
        });
      })();
      return;
    }

    case "GET_AUTH_TOKEN":
      startOAuth().then(sendResponse);
      return true;

    case "GET_PROGRESS": {
      const p = payload as { mediaId: number };
      (async () => {
        const token = await getToken();
        const storage = await getStorage();
        if (token && storage.userId) {
          try {
            const entry = await getProgress(p.mediaId, storage.userId, token);
            sendResponse({ progress: entry?.progress ?? 0 });
          } catch (err) {
            if (isTokenExpiredError(err)) {
              await handleTokenExpired();
            }
            sendResponse({ progress: null });
          }
        } else {
          sendResponse({ progress: null });
        }
      })();
      return true;
    }

    case "SEARCH_ANILIST": {
      const p = payload as { title: string; mediaType: MediaDetection["mediaType"] };
      const searchTitle = normalizeSearchTitle(p.title);
      const search = p.mediaType === "ANIME" ? searchAnime(searchTitle) : searchManga(searchTitle);
      search.then((results) => sendResponse({ results }));
      return true;
    }

    case "GET_PROGRESS_CACHE": {
      const p = payload as { mediaType: MediaDetection["mediaType"] };
      handleGetProgressCache(p.mediaType).then(sendResponse);
      return true;
    }

    case "FLUSH_PENDING_UPDATES":
      flushPendingUpdates().then(() => sendResponse({ done: true }));
      return true;

    case "ALIAS_SUBMIT":
      submitAlias(payload as AliasSubmitPayload);
      return;
  }
});
