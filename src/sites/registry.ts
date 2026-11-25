import type { MediaType, SupportedSite } from "../types";
import { getCatalog, type CatalogSite } from "./catalog";

export interface SiteInfo {
  id: SupportedSite;
  displayName: string;
  isAnime: boolean;
}

export interface SupportedSiteEntry {
  id: SupportedSite;
  displayName: string;
  hostnames: string[];
  kinds: MediaType[];
  official: boolean;
  access: CatalogSite["access"];
  defaultEnabled: boolean;
}

export const INCLUDE_DEV_SITES = import.meta.env.MODE === "development";

export const SITES: CatalogSite[] = getCatalog(INCLUDE_DEV_SITES);

const GENERIC_INFO: SiteInfo = { id: "generic", displayName: "Generic Site", isAnime: false };

const SITE_BY_ID = new Map<SupportedSite, CatalogSite>(SITES.map((site) => [site.id, site]));

export const HOSTNAME_TO_SITE: Record<string, SupportedSite> = Object.fromEntries(
  SITES.flatMap((site) => site.hostnames.map((host) => [host, site.id] as const))
);

export function getCatalogSite(site: SupportedSite): CatalogSite | null {
  return SITE_BY_ID.get(site) ?? null;
}

export function getSiteInfo(site: SupportedSite): SiteInfo {
  const entry = SITE_BY_ID.get(site);
  if (!entry) return { ...GENERIC_INFO, id: site };
  return { id: entry.id, displayName: entry.displayName, isAnime: entry.isAnime };
}

export function getSiteForHostname(hostname: string): SiteInfo | null {
  const site = HOSTNAME_TO_SITE[hostname];
  if (!site) return null;
  return getSiteInfo(site);
}

export function getSupportedSites(): SupportedSiteEntry[] {
  return SITES.map((site) => ({
    id: site.id,
    displayName: site.displayName,
    hostnames: site.hostnames.filter((host) => !host.startsWith("www.")),
    kinds: site.kinds,
    official: site.official,
    access: site.access,
    defaultEnabled: site.defaultEnabled,
  })).sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function getDisplayName(site: SupportedSite): string {
  return getSiteInfo(site).displayName;
}

export function isAnimeSite(site: SupportedSite, pathname?: string): boolean {
  if (site === "aniverse") return pathname?.startsWith("/watch/") ?? false;
  return getSiteInfo(site).isAnime;
}
