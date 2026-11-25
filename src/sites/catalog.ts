import type { MediaType, SupportedSite } from "../types";

export type SiteAccess = "static" | "optional";

export interface CatalogSite {
  id: Exclude<SupportedSite, "generic">;
  displayName: string;
  kinds: MediaType[];
  isAnime: boolean;
  official: boolean;
  defaultEnabled: boolean;
  access: SiteAccess;
  hostnames: string[];
  devOnly?: boolean;
}

const ALL_SITES: CatalogSite[] = [
  {
    id: "asura",
    displayName: "Asura Comics",
    kinds: ["MANGA"],
    isAnime: false,
    official: false,
    defaultEnabled: true,
    access: "static",
    hostnames: ["asuracomic.net", "www.asuracomic.net"],
  },
  {
    id: "flame",
    displayName: "Flame Comics",
    kinds: ["MANGA"],
    isAnime: false,
    official: false,
    defaultEnabled: true,
    access: "static",
    hostnames: ["flamecomics.xyz", "www.flamecomics.xyz"],
  },
  {
    id: "reaper",
    displayName: "Reaper Scans",
    kinds: ["MANGA"],
    isAnime: false,
    official: false,
    defaultEnabled: true,
    access: "static",
    hostnames: ["reaperscans.com", "www.reaperscans.com"],
  },
  {
    id: "raijin",
    displayName: "Raijin Scans",
    kinds: ["MANGA"],
    isAnime: false,
    official: false,
    defaultEnabled: true,
    access: "static",
    hostnames: ["raijin-scans.fr", "www.raijin-scans.fr"],
  },
  {
    id: "aniverse",
    displayName: "Aniverse",
    kinds: ["MANGA", "ANIME"],
    isAnime: false,
    official: false,
    defaultEnabled: true,
    access: "static",
    hostnames: ["aniverse.fr", "www.aniverse.fr"],
  },
  {
    id: "webtoon",
    displayName: "Webtoon",
    kinds: ["MANGA"],
    isAnime: false,
    official: true,
    defaultEnabled: true,
    access: "static",
    hostnames: ["webtoons.com", "www.webtoons.com"],
  },
  {
    id: "mangadex",
    displayName: "MangaDex",
    kinds: ["MANGA"],
    isAnime: false,
    official: false,
    defaultEnabled: true,
    access: "static",
    hostnames: ["mangadex.org", "www.mangadex.org"],
  },
  {
    id: "mangaplus",
    displayName: "MangaPlus",
    kinds: ["MANGA"],
    isAnime: false,
    official: true,
    defaultEnabled: true,
    access: "static",
    hostnames: ["mangaplus.shueisha.co.jp"],
  },
  {
    id: "crunchyroll",
    displayName: "Crunchyroll",
    kinds: ["ANIME"],
    isAnime: true,
    official: true,
    defaultEnabled: true,
    access: "static",
    hostnames: ["crunchyroll.com", "www.crunchyroll.com"],
  },
  {
    id: "voiranime",
    displayName: "Voir Anime",
    kinds: ["ANIME"],
    isAnime: true,
    official: false,
    defaultEnabled: true,
    access: "static",
    hostnames: ["voir-anime.to", "www.voir-anime.to"],
  },
  {
    id: "anime-sama",
    displayName: "Anime Sama",
    kinds: ["MANGA", "ANIME"],
    isAnime: true,
    official: false,
    defaultEnabled: true,
    access: "static",
    hostnames: ["anime-sama.to", "anime-sama.fr", "www.anime-sama.fr"],
  },
  {
    id: "aniwatch",
    displayName: "Aniwatch",
    kinds: ["ANIME"],
    isAnime: true,
    official: false,
    defaultEnabled: true,
    access: "static",
    hostnames: ["aniwatch.cx", "www.aniwatch.cx"],
  },
  {
    id: "mangapill",
    displayName: "MangaPill",
    kinds: ["MANGA"],
    isAnime: false,
    official: false,
    defaultEnabled: false,
    access: "optional",
    hostnames: ["mangapill.com", "www.mangapill.com"],
    devOnly: true,
  },
];

export function getCatalog(includeDevOnly: boolean): CatalogSite[] {
  return ALL_SITES.filter((site) => includeDevOnly || !site.devOnly);
}

export function toMatchPatterns(site: Pick<CatalogSite, "hostnames">): string[] {
  return site.hostnames.map((host) => `https://${host}/*`);
}
