import type { SupportedSite } from "../types";
import { SITES, getCatalogSite, HOSTNAME_TO_SITE } from "./registry";

export function defaultEnabledSites(): SupportedSite[] {
  return SITES.filter((site) => site.defaultEnabled).map((site) => site.id);
}

export function legacyEnabledSites(): SupportedSite[] {
  return SITES.filter((site) => site.access === "static").map((site) => site.id);
}

export function resolveEnabledSites(stored: SupportedSite[] | null | undefined): SupportedSite[] {
  if (!Array.isArray(stored)) return legacyEnabledSites();
  return stored.filter((id) => getCatalogSite(id) !== null);
}

export async function readEnabledSites(): Promise<SupportedSite[]> {
  const { enabledSites } = await chrome.storage.local.get({ enabledSites: null });
  return resolveEnabledSites(enabledSites as SupportedSite[] | null);
}

export async function writeEnabledSites(sites: SupportedSite[]): Promise<void> {
  await chrome.storage.local.set({ enabledSites: Array.from(new Set(sites)) });
}

export async function isSiteEnabled(site: SupportedSite): Promise<boolean> {
  return (await readEnabledSites()).includes(site);
}

export async function isHostnameEnabled(hostname: string): Promise<boolean> {
  const site = HOSTNAME_TO_SITE[hostname];
  if (!site) return false;
  return isSiteEnabled(site);
}
