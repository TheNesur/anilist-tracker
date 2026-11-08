import type { MediaDetection, SupportedSite } from "../../types";
import { cleanTitle, stripChapterSuffix, stripScanlationSuffix } from "../utils";

const RE_NON_EPISODE_PATH = /^\/(?:anime|series|bookmark|schedule|az-lists|genres|ongoing|completed)\b/i;
const RE_URL_EPISODE = /episode-(\d+(?:\.\d+)?)/i;
const RE_HEADING_EPISODE = /(?:episode|ep\.?)\s*(\d+(?:\.\d+)?)/i;
const RE_LEADING_NUMBER = /(\d+(?:\.\d+)?)/;
const RE_MEDIA_TAG_BRACKETS =
  /\s*\[(?:4k|1080p|720p|480p|360p|hd|fhd|uhd|web-?dl|bd|dvd|raw|sub|dub|eng\s*sub|sub\s*indo|indo\s*sub|multi\s*sub|batch|complete|remake|uncensored|re-?upload|\d+)\]/gi;
const RE_TRAILING_YEAR = /\s*\((?:19|20)\d{2}\)\s*$/;
const RE_FINAL_SEASON_NUM = /\bFinal\s+Season\s+(\d+)\b/gi;
const RE_SEASON_NUM_FINAL = /\bSeason\s+(\d+)\s+Final(?:\s+Season)?\b/gi;

export function normalizeDonghuaSeriesTitle(raw: string): string {
  const normalized = stripChapterSuffix(raw)
    .replace(RE_MEDIA_TAG_BRACKETS, "")
    .replace(RE_TRAILING_YEAR, "")
    .replace(RE_FINAL_SEASON_NUM, (_m, p1) => `Season ${p1}`)
    .replace(RE_SEASON_NUM_FINAL, (_m, p1) => `Season ${p1}`)
    .replace(/\s+/g, " ")
    .trim();

  return cleanTitle(stripScanlationSuffix(normalized));
}

export function isDonghuaEpisodePage(): boolean {
  if (RE_NON_EPISODE_PATH.test(window.location.pathname)) return false;
  if (document.querySelector('.megavid, #singlepisode, meta[itemprop="episodeNumber"]')) {
    return extractDonghuaEpisode() !== null;
  }
  return RE_URL_EPISODE.test(window.location.pathname);
}

export function extractDonghuaEpisode(): number | null {
  const metaContent = document
    .querySelector<HTMLMetaElement>('meta[itemprop="episodeNumber"]')
    ?.content?.trim();
  if (metaContent) {
    const match = metaContent.match(RE_LEADING_NUMBER);
    if (match) {
      const parsed = Math.floor(parseFloat(match[1]));
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  }

  const urlMatch = window.location.pathname.match(RE_URL_EPISODE);
  if (urlMatch) {
    const parsed = Math.floor(parseFloat(urlMatch[1]));
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  const heading = document.querySelector<HTMLElement>("h1.entry-title, h1")?.textContent ?? "";
  const headingMatch = heading.match(RE_HEADING_EPISODE);
  if (headingMatch) {
    const parsed = Math.floor(parseFloat(headingMatch[1]));
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  return null;
}

export function extractDonghuaTitle(): string | null {
  const candidates = [
    document.querySelector<HTMLElement>('[itemprop="partOfSeries"]')?.textContent,
    document.querySelector<HTMLElement>(
      "#singlepisode .headlist .det h2 a, #singlepisode .headlist .det h3 a"
    )?.textContent,
    document.querySelector<HTMLElement>(
      '.ts-breadcrumb [itemprop="itemListElement"]:nth-child(2) [itemprop="name"]'
    )?.textContent,
    document.querySelector<HTMLElement>("h1.entry-title, h1")?.textContent,
  ];

  for (const raw of candidates) {
    const trimmed = raw?.replace(/\s+/g, " ").trim();
    if (!trimmed) continue;
    const cleaned = normalizeDonghuaSeriesTitle(trimmed);
    if (cleaned) return cleaned;
  }

  return null;
}

export class AnimeXinParser {
  site: SupportedSite = "animexin";

  isChapterPage(): boolean {
    return isDonghuaEpisodePage();
  }

  detect(): MediaDetection | null {
    if (!this.isChapterPage()) return null;

    const title = extractDonghuaTitle();
    const episode = extractDonghuaEpisode();
    if (!title || episode === null) return null;

    return {
      title,
      progress: episode,
      mediaType: "ANIME",
      source: this.site,
      url: window.location.href,
    };
  }
}
