import { errMsg } from "../utils/dom";
import { getViewer } from "../utils/anilist";
import { markTokenExpired, setStorage, setToken } from "../utils/storage";
import { isTokenExpiredError, type OAuthResult } from "../types";
import { sleep } from "../utils/sleep";
import { clearTabBadge, setTabBadge } from "./badge";

const CLIENT_ID = import.meta.env.VITE_ANILIST_CLIENT_ID;
const REDIRECT_URL = import.meta.env.VITE_ANILIST_REDIRECT_URI;
const TOKEN_ENDPOINT = import.meta.env.VITE_TOKEN_ENDPOINT || "https://auth.mraitchkovitch.fr/callback";

const OAUTH_FLOW_KEY = "oauthFlow";
const OAUTH_RESULT_KEY = "oauthResult";
const OAUTH_TIMEOUT_ALARM = "anilist-tracker:oauth-timeout";
const OAUTH_TIMEOUT_MIN = 3;
const VIEWER_RETRY_DELAYS_MS = [500, 1000, 2000];

export { TOKEN_ENDPOINT, OAUTH_TIMEOUT_ALARM };

interface OAuthFlow {
  state: string;
  tabId: number;
  startedAt: number;
}

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

export async function handleTokenExpired(tabId?: number): Promise<void> {
  await markTokenExpired();
  if (tabId !== undefined) {
    setTabBadge(tabId, "!", "#e74c3c");
  }
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

async function readFlow(): Promise<OAuthFlow | null> {
  const data = await chrome.storage.session.get(OAUTH_FLOW_KEY);
  return (data[OAUTH_FLOW_KEY] as OAuthFlow | undefined) ?? null;
}

async function claimFlow(tabId: number): Promise<OAuthFlow | null> {
  const flow = await readFlow();
  if (!flow || flow.tabId !== tabId) return null;
  await chrome.storage.session.remove(OAUTH_FLOW_KEY);
  await chrome.alarms.clear(OAUTH_TIMEOUT_ALARM);
  return flow;
}

async function clearFlow(): Promise<void> {
  await chrome.storage.session.remove(OAUTH_FLOW_KEY);
  await chrome.alarms.clear(OAUTH_TIMEOUT_ALARM);
}

async function publishResult(result: OAuthResult): Promise<void> {
  await clearFlow();
  await chrome.storage.session.set({ [OAUTH_RESULT_KEY]: result });
}

async function exchangeCode(code: string): Promise<OAuthResult> {
  try {
    const tokenRes = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, redirect_uri: REDIRECT_URL }),
    });

    const rawBody = await tokenRes.text().catch(() => "");

    let tokenData: { ok?: boolean; access_token?: unknown } | null = null;
    try {
      tokenData = JSON.parse(rawBody);
    } catch {
      tokenData = null;
    }

    if (
      !tokenData ||
      tokenData.ok === false ||
      typeof tokenData.access_token !== "string" ||
      tokenData.access_token.length === 0
    ) {
      console.error(
        `[AniList Tracker] Token exchange failed: HTTP ${tokenRes.status} from ${TOKEN_ENDPOINT} — ${rawBody.slice(0, 300)}`
      );
      return { success: false, error: `Token exchange failed (HTTP ${tokenRes.status})` };
    }

    const accessToken = tokenData.access_token;
    await setToken(accessToken);

    try {
      const viewer = await getViewerWithRetry(accessToken);
      await setStorage({ userId: viewer.id, username: viewer.name });
      return { success: true, username: viewer.name };
    } catch (err) {
      console.error("[AniList Tracker] getViewer failed:", errMsg(err));
      await chrome.storage.session.set({ viewerFetchFailed: true });
      return { success: true, username: null, partial: true };
    }
  } catch (err) {
    console.error("[AniList Tracker] OAuth error:", errMsg(err));
    return { success: false, error: "OAuth error" };
  }
}

async function handleRedirect(url: string, flow: OAuthFlow): Promise<void> {
  const parsed = new URL(url);
  const code = parsed.searchParams.get("code");
  const returnedState = parsed.searchParams.get("state");
  const oauthError = parsed.searchParams.get("error");

  if (oauthError) {
    await publishResult({ success: false, cancelled: oauthError === "access_denied" });
    return;
  }

  if (!returnedState || returnedState !== flow.state) {
    console.error("[AniList Tracker] OAuth state mismatch");
    await publishResult({ success: false, error: "State mismatch" });
    return;
  }

  if (!code) {
    await publishResult({ success: false, error: "No code received" });
    return;
  }

  const result = await exchangeCode(code);
  await publishResult(result);

  if (result.success) {
    clearTabBadge(flow.tabId);
  }
}

const handlingTabs = new Set<number>();

function onTabUpdated(
  tabId: number,
  changeInfo: chrome.tabs.TabChangeInfo,
  tab: chrome.tabs.Tab
): void {
  const url = changeInfo.url ?? tab.url;
  if (!url || !isValidRedirectUrl(url)) return;
  if (handlingTabs.has(tabId)) return;

  handlingTabs.add(tabId);

  (async () => {
    try {
      const flow = await claimFlow(tabId);
      if (!flow) return;
      await handleRedirect(url, flow);
    } finally {
      handlingTabs.delete(tabId);
    }
  })().catch(() => {});
}

async function onTabRemoved(tabId: number): Promise<void> {
  const flow = await readFlow();
  if (!flow || flow.tabId !== tabId) return;
  await publishResult({ success: false, cancelled: true });
}

chrome.tabs.onUpdated.addListener(onTabUpdated);

chrome.tabs.onRemoved.addListener((tabId) => {
  onTabRemoved(tabId).catch(() => {});
});

export async function handleOAuthTimeout(): Promise<void> {
  const flow = await readFlow();
  if (!flow) return;
  chrome.tabs.remove(flow.tabId).catch(() => {});
  await publishResult({ success: false, error: "Timed out waiting for AniList", timedOut: true });
}

export async function startOAuth(): Promise<{ started: boolean; error?: string }> {
  await chrome.storage.session.remove(OAUTH_RESULT_KEY);
  await clearFlow();

  const state = generateState();
  const authUrl =
    `https://anilist.co/api/v2/oauth/authorize` +
    `?client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URL)}` +
    `&response_type=code` +
    `&state=${encodeURIComponent(state)}`;

  const tab = await chrome.tabs.create({ url: authUrl }).catch(() => null);

  if (!tab?.id) {
    return { started: false, error: "Could not open tab" };
  }

  await chrome.storage.session.set({
    [OAUTH_FLOW_KEY]: { state, tabId: tab.id, startedAt: Date.now() } satisfies OAuthFlow,
  });
  chrome.alarms.create(OAUTH_TIMEOUT_ALARM, { delayInMinutes: OAUTH_TIMEOUT_MIN });

  return { started: true };
}