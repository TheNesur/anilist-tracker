import { getTheme, getToken } from "../utils/storage";
import { t } from "../utils/i18n";
import type { OAuthResult } from "../types";
import { applyTheme, btnLogin, btnSettings, showView, usernameEl } from "./elements";
import { startOAuth } from "./messaging";
import { setGenericPickHandler } from "./render";
import { proceedWithGenericDetection, resolveState, scheduleResolve, scheduleResolveIfAllowed } from "./resolve";
import { setRefreshHandler, tabStateKey } from "./state";
import { renderPendingErrors, renderPendingQueue } from "./views/banners";

const OAUTH_RESULT_KEY = "oauthResult";

let loginInFlight = false;

async function refreshAccountLabel(): Promise<void> {
  const { username, userId } = await chrome.storage.local.get({ username: null, userId: null });
  usernameEl.textContent = username ?? (userId ? `#${userId}` : "—");
}

function applyOAuthResult(result: OAuthResult): void {
  loginInFlight = false;

  if (result.success) {
    showView("main");
    refreshAccountLabel();
    resolveState();
    renderPendingQueue();
    return;
  }

  showView("login");
  btnLogin.textContent = t("btnLogin");

  if (result.error) {
    console.error("[AniList Tracker] OAuth failed:", result.error);
  }

  if (result.timedOut) {
    alert(t("connectionTimeout"));
    return;
  }

  if (!result.cancelled) {
    alert(t("connectionFailed"));
  }
}

async function consumeOAuthResult(): Promise<boolean> {
  const data = await chrome.storage.session.get(OAUTH_RESULT_KEY);
  const result = data[OAUTH_RESULT_KEY] as OAuthResult | undefined;
  if (!result) return false;

  await chrome.storage.session.remove(OAUTH_RESULT_KEY);
  applyOAuthResult(result);
  return true;
}

function registerListeners(): void {
  chrome.storage.session.onChanged.addListener((changes) => {
    if (changes[OAUTH_RESULT_KEY]?.newValue) {
      consumeOAuthResult();
      return;
    }

    const key = tabStateKey();
    if (key && changes[key]) {
      scheduleResolveIfAllowed();
    }
  });

  chrome.storage.local.onChanged.addListener((changes) => {
    if (changes.pendingUpdates) {
      renderPendingQueue();
    }
    if (changes.tokenExpired) {
      scheduleResolve();
    }
  });
}

btnLogin.addEventListener("click", async () => {
  if (loginInFlight) return;
  loginInFlight = true;

  btnLogin.textContent = t("stateLoading");
  const response = await startOAuth();

  if (!response?.started) {
    loginInFlight = false;
    btnLogin.textContent = t("btnLogin");
    alert(t("connectionFailed"));
  }
});

btnSettings.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

async function init(): Promise<void> {
  applyTheme(await getTheme());

  setRefreshHandler(resolveState);
  setGenericPickHandler(proceedWithGenericDetection);

  document.getElementById("login-description")!.textContent = t("loginDescription");
  document.getElementById("footer-anilist")!.textContent = t("openAniList");
  btnLogin.textContent = t("btnLogin");

  registerListeners();

  await consumeOAuthResult();
  const token = await getToken();

  if (!token) {
    showView("login");
    return;
  }

  showView("main");
  await refreshAccountLabel();
  await resolveState();
  await renderPendingQueue();
  await renderPendingErrors();
}

init();