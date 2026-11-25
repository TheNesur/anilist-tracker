import type { SupportedSite } from "../types";
import { contentScriptId, hasSiteAccess, optionalSites, patternsFor } from "../sites/access";
import { defaultEnabledSites, legacyEnabledSites, readEnabledSites } from "../sites/enabled";
import { getCatalogSite, HOSTNAME_TO_SITE } from "../sites/registry";
import { setTabBadge } from "./badge";

const DYNAMIC_SCRIPT_FILE = "content/dynamic.js";
const SCRIPT_ID_PREFIX = "site-";
const OFF_BADGE_TEXT = "OFF";
const OFF_BADGE_COLOR = "#6b7c93";

let syncChain: Promise<void> = Promise.resolve();

const SESSION_SYNC_KEY = "sitesSyncedThisSession";

export function syncSites(): Promise<void> {
  syncChain = syncChain.then(runSync, runSync);
  return syncChain;
}

export async function syncSitesOncePerSession(): Promise<void> {
  const data = await chrome.storage.session.get(SESSION_SYNC_KEY);
  if (data[SESSION_SYNC_KEY]) return;
  await syncSites();
  await chrome.storage.session.set({ [SESSION_SYNC_KEY]: true });
}

async function desiredSites(): Promise<SupportedSite[]> {
  const enabled = await readEnabledSites();
  const result: SupportedSite[] = [];
  for (const site of optionalSites()) {
    if (!enabled.includes(site.id)) continue;
    if (await hasSiteAccess(site.id)) result.push(site.id);
  }
  return result;
}

async function runSync(): Promise<void> {
  try {
    const desired = await desiredSites();
    const registered = (await chrome.scripting.getRegisteredContentScripts()).filter((script) =>
      script.id.startsWith(SCRIPT_ID_PREFIX)
    );
    const registeredById = new Map(registered.map((script) => [script.id, script]));
    const desiredIds = new Set(desired.map(contentScriptId));

    const stale = registered
      .filter((script) => {
        if (!desiredIds.has(script.id)) return true;
        const site = desired.find((id) => contentScriptId(id) === script.id)!;
        const current = [...(script.matches ?? [])].sort().join("|");
        const expected = [...patternsFor(site)].sort().join("|");
        return current !== expected || script.js?.[0] !== DYNAMIC_SCRIPT_FILE;
      })
      .map((script) => script.id);

    if (stale.length > 0) {
      await chrome.scripting.unregisterContentScripts({ ids: stale });
    }

    const staleSet = new Set(stale);
    const toRegister = desired.filter((site) => {
      const id = contentScriptId(site);
      return !registeredById.has(id) || staleSet.has(id);
    });

    if (toRegister.length > 0) {
      await chrome.scripting.registerContentScripts(
        toRegister.map((site) => ({
          id: contentScriptId(site),
          matches: patternsFor(site),
          js: [DYNAMIC_SCRIPT_FILE],
          runAt: "document_idle" as const,
          persistAcrossSessions: true,
        }))
      );
      await injectIntoOpenTabs(toRegister);
    }
  } catch (err) {
    console.error("[AniList Tracker] Site sync failed:", err);
  }

  await refreshAllDisabledBadges();
}

async function injectIntoOpenTabs(sites: SupportedSite[]): Promise<void> {
  const url = sites.flatMap(patternsFor);
  if (url.length === 0) return;
  let tabs: chrome.tabs.Tab[] = [];
  try {
    tabs = await chrome.tabs.query({ url });
  } catch {
    return;
  }
  await Promise.all(
    tabs.map(async (tab) => {
      if (tab.id === undefined) return;
      try {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: [DYNAMIC_SCRIPT_FILE] });
      } catch {
        return;
      }
    })
  );
}

export async function applyInstallDefaults(): Promise<boolean> {
  const { enabledSites, onboardingDone } = await chrome.storage.local.get({
    enabledSites: null,
    onboardingDone: false,
  });
  if (enabledSites === null) {
    await chrome.storage.local.set({ enabledSites: defaultEnabledSites() });
  }
  return !onboardingDone;
}

export async function migrateLegacyInstall(): Promise<void> {
  const { enabledSites, onboardingDone } = await chrome.storage.local.get({
    enabledSites: null,
    onboardingDone: false,
  });
  if (enabledSites !== null || onboardingDone) return;
  await chrome.storage.local.set({ enabledSites: legacyEnabledSites(), onboardingDone: true });
}

export async function openOnboarding(): Promise<void> {
  await chrome.tabs.create({ url: chrome.runtime.getURL("src/onboarding/onboarding.html") });
}

async function isTabSiteDisabled(url: string | undefined): Promise<boolean> {
  if (!url) return false;
  let hostname: string;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    hostname = parsed.hostname;
  } catch {
    return false;
  }
  const site = HOSTNAME_TO_SITE[hostname];
  if (!site || !getCatalogSite(site)) return false;
  const enabled = await readEnabledSites();
  if (!enabled.includes(site)) return true;
  return !(await hasSiteAccess(site));
}

export async function refreshDisabledBadge(tabId: number, url: string | undefined): Promise<void> {
  try {
    if (await isTabSiteDisabled(url)) {
      setTabBadge(tabId, OFF_BADGE_TEXT, OFF_BADGE_COLOR);
      return;
    }
    const current = await chrome.action.getBadgeText({ tabId });
    if (current === OFF_BADGE_TEXT) {
      await chrome.action.setBadgeText({ tabId, text: "" });
    }
  } catch {
    return;
  }
}

export async function refreshAllDisabledBadges(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({});
    await Promise.all(
      tabs.map((tab) => (tab.id === undefined ? Promise.resolve() : refreshDisabledBadge(tab.id, tab.url)))
    );
  } catch {
    return;
  }
}
