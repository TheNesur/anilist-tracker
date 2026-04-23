import { searchManga, getProgress, updateProgress, getViewer } from "../utils/anilist";
import { getStorage, setStorage, getToken, getTitleMapping, saveTitleMapping } from "../utils/storage";
import type { MangaDetection, AniListMedia } from "../types";

//  AniList OAuth config 
// TODO: Replace with your AniList app client ID
const CLIENT_ID = import.meta.env.VITE_ANILIST_CLIENT_ID;
const CLIENT_SECRET = import.meta.env.VITE_ANILIST_CLIENT_SECRET;
const REDIRECT_URL = import.meta.env.VITE_ANILIST_REDIRECT_URL;

const OAUTH_URL = `https://anilist.co/api/v2/oauth/authorize?client_id=${CLIENT_ID}&response_type=token`;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "MANGA_DETECTED") {
    handleDetection(message.payload as MangaDetection);
  }

  if (message.type === "UPDATE_PROGRESS") {
    const { mediaId, chapter } = message.payload as {
      mediaId: number;
      chapter: number;
    };
    handleUpdate(mediaId, chapter).then(sendResponse);
    return true;
  }

  if (message.type === "GET_AUTH_TOKEN") {
    startOAuth().then(sendResponse);
    return true;
  }
  
  if (message.type === "GET_PROGRESS") {
  const { mediaId } = message.payload as { mediaId: number };
  (async () => {
    const token = await getToken();
    const storage = await getStorage();
    if (token && storage.userId) {
      const entry = await getProgress(mediaId, storage.userId, token);
      sendResponse({ progress: entry?.progress ?? null });
    } else {
      sendResponse({ progress: null });
    }
  })();
  return true;
}
});

async function handleDetection(detection: MangaDetection) {
  const token = await getToken();
  if (!token) {
    chrome.action.setBadgeText({ text: "!" });
    chrome.action.setBadgeBackgroundColor({ color: "#e74c3c" });
    return;
  }

  const mappedId = await getTitleMapping(detection.title);
  let mediaId = mappedId;

  if (!mediaId) {
    const results = await searchManga(detection.title);
    if (results.length === 0) {
      console.log("[AniList Tracker] No AniList results for:", detection.title);
      notifyUser(detection, null);
      return;
    }
    mediaId = results[0].id;
    notifyUser(detection, results);
    return;
  }

  const storage = await getStorage();
  let currentProgress: number | null = null;
  if (storage.userId) {
    const entry = await getProgress(mediaId, storage.userId, token!);
    currentProgress = entry?.progress ?? null;
  }

  if (storage.autoUpdate && (currentProgress === null || detection.chapter > currentProgress)) {
    await handleUpdate(mediaId, detection.chapter);
  } else {
    notifyUser(detection, null, mediaId, currentProgress);
  }
}

async function handleUpdate(mediaId: number, chapter: number) {
  const token = await getToken();
  if (!token) return { success: false, error: "Not authenticated" };

  const storage = await getStorage();
  if (!storage.userId) return { success: false, error: "No user ID" };

  try {
    const current = await getProgress(mediaId, storage.userId, token);

    if (current && current.progress >= chapter) {
      return { success: true, skipped: true, current: current.progress };
    }

    const result = await updateProgress(mediaId, chapter, token);
    console.log("[AniList Tracker] Updated:", result);

    chrome.action.setBadgeText({ text: "✓" });
    chrome.action.setBadgeBackgroundColor({ color: "#2ecc71" });
    setTimeout(() => chrome.action.setBadgeText({ text: "" }), 3000);

    return { success: true, progress: result.progress };
  } catch (err) {
    console.error("[AniList Tracker] Update failed:", err);
    return { success: false, error: String(err) };
  }
}

function notifyUser(
  detection: MangaDetection,
  searchResults: AniListMedia[] | null,
  confirmedMediaId?: number,
  currentProgress?: number | null
) {
  chrome.storage.session.set({
    lastDetection: detection,
    searchResults,
    confirmedMediaId: confirmedMediaId ?? null,
    currentProgress: currentProgress ?? null,
  });

  chrome.action.setBadgeText({ text: "?" });
  chrome.action.setBadgeBackgroundColor({ color: "#3498db" });
}

async function startOAuth() {
  const authUrl = `https://anilist.co/api/v2/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URL)}&response_type=code`;

  console.log("[AniList Tracker] Opening auth URL:", authUrl);

  try {
    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true,
    });

    console.log("[AniList Tracker] Response URL:", responseUrl);

    if (!responseUrl) return { success: false };

    const url = new URL(responseUrl);
    const code = url.searchParams.get("code");

    if (!code) return { success: false, error: "No code received" };

    console.log("[AniList Tracker] Got auth code, exchanging for token...");

    const tokenRes = await fetch("https://anilist.co/api/v2/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URL,
        code,
      }),
    });

    const tokenData = await tokenRes.json();
    console.log("[AniList Tracker] Token response:", tokenData);

    if (!tokenData.access_token) {
      return { success: false, error: "No token in response" };
    }

    const accessToken = tokenData.access_token;

    const viewer = await getViewer(accessToken);

    await setStorage({
      accessToken,
      userId: viewer.id,
    });

    return { success: true, username: viewer.name };
  } catch (err) {
    console.error("[AniList Tracker] OAuth error:", err);
    return { success: false, error: String(err) };
  }
}