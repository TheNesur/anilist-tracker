import type { MediaType, SupportedSite } from "../types";

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
}

const SITE_META: Record<SupportedSite, { displayName: string; isAnime: boolean; kinds: MediaType[] }> = {
  asura: { displayName: "Asura Comics", isAnime: false, kinds: ["MANGA"] },
  flame: { displayName: "Flame Comics", isAnime: false, kinds: ["MANGA"] },
  reaper: { displayName: "Reaper Scans", isAnime: false, kinds: ["MANGA"] },
  raijin: { displayName: "Raijin Scans", isAnime: false, kinds: ["MANGA"] },
  aniverse: { displayName: "Aniverse", isAnime: false, kinds: ["MANGA", "ANIME"] },
  webtoon: { displayName: "Webtoon", isAnime: false, kinds: ["MANGA"] },
  mangadex: { displayName: "MangaDex", isAnime: false, kinds: ["MANGA"] },
  mangaplus: { displayName: "MangaPlus", isAnime: false, kinds: ["MANGA"] },
  crunchyroll: { displayName: "Crunchyroll", isAnime: true, kinds: ["ANIME"] },
  voiranime: { displayName: "Voir Anime", isAnime: true, kinds: ["ANIME"] },
  "anime-sama": { displayName: "Anime Sama", isAnime: true, kinds: ["MANGA", "ANIME"] },
  aniwatch: { displayName: "Aniwatch", isAnime: true, kinds: ["ANIME"] },
  generic: { displayName: "Generic Site", isAnime: false, kinds: [] },
};

const HOSTNAME_ENTRIES: [string, SupportedSite][] = [
  ["asuracomic.net", "asura"],
  ["www.asuracomic.net", "asura"],

  ["flamecomics.xyz", "flame"],
  ["www.flamecomics.xyz", "flame"],

  ["reaperscans.com", "reaper"],
  ["www.reaperscans.com", "reaper"],

  ["raijin-scans.fr", "raijin"],
  ["www.raijin-scans.fr", "raijin"],

  ["aniverse.fr", "aniverse"],
  ["www.aniverse.fr", "aniverse"],

  ["webtoons.com", "webtoon"],
  ["www.webtoons.com", "webtoon"],

  ["mangadex.org", "mangadex"],
  ["www.mangadex.org", "mangadex"],

  ["mangaplus.shueisha.co.jp", "mangaplus"],

  ["crunchyroll.com", "crunchyroll"],
  ["www.crunchyroll.com", "crunchyroll"],

  ["voir-anime.to", "voiranime"],
  ["www.voir-anime.to", "voiranime"],

  ["anime-sama.to", "anime-sama"],
  ["anime-sama.fr", "anime-sama"],
  ["www.anime-sama.fr", "anime-sama"],

  ["aniwatch.cx", "aniwatch"],
  ["www.aniwatch.cx", "aniwatch"],
];

export const HOSTNAME_TO_SITE: Record<string, SupportedSite> = Object.fromEntries(HOSTNAME_ENTRIES);

export function getSiteInfo(site: SupportedSite): SiteInfo {
  const meta = SITE_META[site];
  return { id: site, ...meta };
}

export function getSiteForHostname(hostname: string): SiteInfo | null {
  const site = HOSTNAME_TO_SITE[hostname];
  if (!site) return null;
  return getSiteInfo(site);
}

export function getSupportedSites(): SupportedSiteEntry[] {
  const entries: SupportedSiteEntry[] = [];
  for (const [id, meta] of Object.entries(SITE_META) as [SupportedSite, (typeof SITE_META)[SupportedSite]][]) {
    if (id === "generic") continue;
    const hostnames = HOSTNAME_ENTRIES
      .filter(([host, site]) => site === id && !host.startsWith("www."))
      .map(([host]) => host);
    entries.push({ id, displayName: meta.displayName, hostnames, kinds: meta.kinds });
  }
  return entries.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function getDisplayName(site: SupportedSite): string {
  return SITE_META[site].displayName;
}

export function isAnimeSite(site: SupportedSite, pathname?: string): boolean {
  if (site === "aniverse") return pathname?.startsWith("/watch/") ?? false;
  return SITE_META[site].isAnime;
}
