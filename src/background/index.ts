import { searchManga, getProgress, updateProgress, getViewer } from "../utils/anilist";
import { getStorage, setStorage, getToken, getTitleMapping, saveTitleMapping } from "../utils/storage";
import type { MangaDetection, AniListMedia } from "../types";

// ── AniList OAuth config ──
// TODO: Replace with your AniList app client ID
const CLIENT_ID = import.meta.env.VITE_ANILIST_CLIENT_ID;
const CLIENT_SECRET = import.meta.env.VITE_ANILIST_CLIENT_SECRET;

const OAUTH_URL = `https://anilist.co/api/v2/oauth/authorize?client_id=${CLIENT_ID}&response_type=token`;

// ── Message listener ──
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
    return true; // async response
  }

  if (message.type === "GET_AUTH_TOKEN") {
    startOAuth().then(sendResponse);
    return true;
  }
});

// ── Handle manga detection from content script ──
async function handleDetection(detection: MangaDetection) {
  const token = await getToken();
  if (!token) {
    // Not logged in, show badge
    chrome.action.setBadgeText({ text: "!" });
    chrome.action.setBadgeBackgroundColor({ color: "#e74c3c" });
    return;
  }

  // Check if we already have a manual mapping for this title
  const mappedId = await getTitleMapping(detection.title);
  let mediaId = mappedId;

  if (!mediaId) {
    // Search AniList for the manga
    const results = await searchManga(detection.title);
    if (results.length === 0) {
      console.log("[AniList Tracker] No AniList results for:", detection.title);
      notifyUser(detection, null);
      return;
    }
    // Use the top result (best match)
    mediaId = results[0].id;
    notifyUser(detection, results);
    return;
  }

  // We have a mapping, check if update is needed
  const storage = await getStorage();
  // Fetch current progress
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

// ── Update progress on AniList ──
async function handleUpdate(mediaId: number, chapter: number) {
  const token = await getToken();
  if (!token) return { success: false, error: "Not authenticated" };

  const storage = await getStorage();
  if (!storage.userId) return { success: false, error: "No user ID" };

  try {
    // Check current progress first
    const current = await getProgress(mediaId, storage.userId, token);

    // Only update if the new chapter is ahead
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

// ── Notify popup that a manga was detected ──
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

// ── AniList OAuth config ──
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

    // Extract the authorization code from the redirect URL
    const url = new URL(responseUrl);
    const code = url.searchParams.get("code");

    if (!code) return { success: false, error: "No code received" };

    console.log("[AniList Tracker] Got auth code, exchanging for token...");

    // Exchange code for access token
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

    // Get user info
    const viewer = await getViewer(accessToken);

    // Save to storage
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