import type { SupportedSite } from "../types";

export interface SiteInfo {
  id: SupportedSite;
  displayName: string;
  isAnime: boolean;
}

const SITE_META: Record<SupportedSite, { displayName: string; isAnime: boolean }> = {
  asura: { displayName: "Asura Comics", isAnime: false },
  flame: { displayName: "Flame Comics", isAnime: false },
  reaper: { displayName: "Reaper Scans", isAnime: false },
  raijin: { displayName: "Raijin Scans", isAnime: false },
  webtoon: { displayName: "Webtoon", isAnime: false },
  mangadex: { displayName: "MangaDex", isAnime: false },
  mangaplus: { displayName: "MangaPlus", isAnime: false },
  crunchyroll: { displayName: "Crunchyroll", isAnime: true },
  voiranime: { displayName: "Voir Anime", isAnime: true },
  "anime-sama": { displayName: "Anime Sama", isAnime: true },
  generic: { displayName: "Generic Site", isAnime: false },
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

export function getDisplayName(site: SupportedSite): string {
  return SITE_META[site].displayName;
}

export function isAnimeSite(site: SupportedSite): boolean {
  return SITE_META[site].isAnime;
}
