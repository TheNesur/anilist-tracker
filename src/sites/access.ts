import type { SupportedSite } from "../types";
import { toMatchPatterns } from "./catalog";
import { SITES, getCatalogSite } from "./registry";

export function patternsFor(site: SupportedSite): string[] {
  const entry = getCatalogSite(site);
  return entry ? toMatchPatterns(entry) : [];
}

export function optionalSites() {
  return SITES.filter((site) => site.access === "optional");
}

export function contentScriptId(site: SupportedSite): string {
  return `site-${site}`;
}

export async function hasSiteAccess(site: SupportedSite): Promise<boolean> {
  const entry = getCatalogSite(site);
  if (!entry) return false;
  if (entry.access === "static") return true;
  try {
    return await chrome.permissions.contains({ origins: patternsFor(site) });
  } catch {
    return false;
  }
}

export async function requestSiteAccess(sites: SupportedSite[]): Promise<boolean> {
  const origins = sites
    .filter((site) => getCatalogSite(site)?.access === "optional")
    .flatMap(patternsFor);
  if (origins.length === 0) return true;
  try {
    return await chrome.permissions.request({ origins });
  } catch {
    return false;
  }
}

export async function removeSiteAccess(sites: SupportedSite[]): Promise<void> {
  const origins = sites
    .filter((site) => getCatalogSite(site)?.access === "optional")
    .flatMap(patternsFor);
  if (origins.length === 0) return;
  try {
    await chrome.permissions.remove({ origins });
  } catch {
    return;
  }
}
