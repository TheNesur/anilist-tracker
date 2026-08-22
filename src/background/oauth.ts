import { getViewer } from "../utils/anilist";
import { setStorage, setToken, setSession } from "../utils/storage";
import { isTokenExpiredError } from "../types";
import { sleep } from "../utils/sleep";

const CLIENT_ID = import.meta.env.VITE_ANILIST_CLIENT_ID;
const REDIRECT_URL = import.meta.env.VITE_ANILIST_REDIRECT_URI;
const TOKEN_ENDPOINT = import.meta.env.VITE_TOKEN_ENDPOINT || "https://auth.mraitchkovitch.fr/callback";

const OAUTH_TIMEOUT_MS = 3 * 60 * 1000;
const VIEWER_RETRY_DELAYS_MS = [500, 1000, 2000];

export { TOKEN_ENDPOINT };

function generateState(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function getViewerWithRetry(token: string) {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= VIEWER_RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await getViewer(token);
    } catch (err) {
      lastErr = err;
      if (isTokenExpiredError(err)) throw err;
      if (attempt < VIEWER_RETRY_DELAYS_MS.length) {
        await sleep(VIEWER_RETRY_DELAYS_MS[attempt]);
      }
    }
  }
  throw lastErr;
}

export async function ensureViewerLoaded(token: string): Promise<number | null> {
  const { userId } = await chrome.storage.local.get({ userId: null });
  if (userId) return userId;

  try {
    const viewer = await getViewerWithRetry(token);
    await setStorage({ userId: viewer.id, username: viewer.name });
    await chrome.storage.session.remove("viewerFetchFailed");
    return viewer.id;
  } catch {
    return null;
  }
}

export async function handleTokenExpired() {
  await setToken(null);
  chrome.action.setBadgeText({ text: "!" });
  chrome.action.setBadgeBackgroundColor({ color: "#e74c3c" });
  await setSession({ tokenExpired: true });
}

function isValidRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const expected = new URL(REDIRECT_URL);
    return parsed.origin === expected.origin && parsed.pathname === expected.pathname;
  } catch {
    return false;
  }
}

export async function startOAuth(): Promise<
  { success: true; username: string | null; partial?: boolean } | { success: false; error?: string; cancelled?: boolean; timedOut?: boolean }
> {
  const state = generateState();
  await chrome.storage.session.set({ oauthState: state });

  const authUrl =
    `https://anilist.co/api/v2/oauth/authorize` +
    `?client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URL)}` +
    `&response_type=code` +
    `&state=${encodeURIComponent(state)}`;

  return new Promise((resolve) => {
    let settled = false;
    let handled = false;
    let tabId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
      if (timeoutId !== null) clearTimeout(timeoutId);
    };

    const finish = async (result: Awaited<ReturnType<typeof startOAuth>>) => {
      if (settled) return;
      settled = true;
      cleanup();
      await chrome.storage.session.remove("oauthState");
      resolve(result);
    };

    timeoutId = setTimeout(() => {
      if (tabId !== null) {
        chrome.tabs.remove(tabId).catch(() => {});
      }
      finish({ success: false, error: "Timed out waiting for AniList", timedOut: true });
    }, OAUTH_TIMEOUT_MS);

    const onUpdated = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
      if (updatedTabId !== tabId) return;
      const url = changeInfo.url ?? tab.url;
      if (!url || !isValidRedirectUrl(url)) return;
      if (handled) return;
      handled = true;

      (async () => {
        const parsed = new URL(url);
        const code = parsed.searchParams.get("code");
        const returnedState = parsed.searchParams.get("state");
        const oauthError = parsed.searchParams.get("error");

        if (oauthError) {
          await finish({ success: false, cancelled: oauthError === "access_denied" });
          return;
        }

        const stored = await chrome.storage.session.get("oauthState");
        const expectedState = stored.oauthState as string | undefined;

        if (!expectedState || !returnedState || returnedState !== expectedState) {
          console.error("[AniList Tracker] OAuth state mismatch");
          await finish({ success: false, error: "State mismatch" });
          return;
        }

        if (!code) {
          await finish({ success: false, error: "No code received" });
          return;
        }

        try {
          const tokenRes = await fetch(TOKEN_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, redirect_uri: REDIRECT_URL }),
          });

          const tokenData = await tokenRes.json().catch(() => null);

          if (
            !tokenData ||
            tokenData.ok === false ||
            typeof tokenData.access_token !== "string" ||
            tokenData.access_token.length === 0
          ) {
            console.error("[AniList Tracker] Token exchange failed");
            await finish({ success: false, error: "Token exchange failed" });
            return;
          }

          const accessToken = tokenData.access_token;
          await setToken(accessToken);

          try {
            const viewer = await getViewerWithRetry(accessToken);
            await setStorage({ userId: viewer.id, username: viewer.name });
            await finish({ success: true, username: viewer.name });
          } catch (err) {
            console.error("[AniList Tracker] getViewer failed:", err instanceof Error ? err.message : "unknown");
            await chrome.storage.session.set({ viewerFetchFailed: true });
            await finish({ success: true, username: null, partial: true });
          }
        } catch (err) {
          console.error("[AniList Tracker] OAuth error:", err instanceof Error ? err.message : "unknown");
          await finish({ success: false, error: "OAuth error" });
        }
      })();
    };

    const onRemoved = (removedTabId: number) => {
      if (removedTabId !== tabId) return;
      finish({ success: false, cancelled: true });
    };

    chrome.tabs.create({ url: authUrl }, (tab) => {
      if (!tab?.id) {
        finish({ success: false, error: "Could not open tab" });
        return;
      }
      tabId = tab.id;
      chrome.tabs.onUpdated.addListener(onUpdated);
      chrome.tabs.onRemoved.addListener(onRemoved);
    });
  });
}
