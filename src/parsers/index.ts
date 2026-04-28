import type { MediaDetection, SupportedSite } from "../types";
import { RaijinParser } from "./manga/raijin";
import { WebtoonParser } from "./manga/webtoon";
import { MangaDexParser } from "./manga/mangadex";
import { MangaPlusParser } from "./manga/mangaplus";
import { AsuraParser } from "./manga/asura";
import { FlameParser } from "./manga/flame";
import { ReaperParser } from "./manga/reaper";
import { CrunchyrollParser } from "./anime/crunchyroll";
import { VoirAnimeParser } from "./anime/voiranime";

export interface SiteParser {
  site: SupportedSite;
  isChapterPage(): boolean;
  detect(): MediaDetection | null;
}

export function getParser(): SiteParser | null {
  const host = window.location.hostname.replace("www.", "");

  if (host.includes("asuracomic")) return new AsuraParser();
  if (host.includes("flamecomics")) return new FlameParser();
  if (host.includes("reaperscans")) return new ReaperParser();
  if (host.includes("raijin-scans") || host.includes("raijinscan")) return new RaijinParser();
  if (host.includes("webtoons")) return new WebtoonParser();
  if (host.includes("mangadex")) return new MangaDexParser();
  if (host.includes("mangaplus")) return new MangaPlusParser();


  if (host.includes("crunchyroll")) return new CrunchyrollParser();
  if (host.includes("voir-anime")) return new VoirAnimeParser();

  return null;
}