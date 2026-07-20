import type { MediaType } from "../types";
import { cleanTitle, extractChapterNumber } from "./utils";

export interface GenericDetectionResult {
  title: string;
  progress: number;
  url: string;
  possibleTypes: MediaType[];
}

const VIDEO_URL_HINTS = /episode|watch|player|streaming/i;
const MANGA_URL_HINTS = /chapter|chapitre|read|scan|manga|manhwa|webtoon/i;

function detectMediaTypeSignals(): { anime: boolean; manga: boolean } {
  const hasVideo = !!document.querySelector("video");
  const hasPlayerClass = !!document.querySelector(
    "[class*='player' i], [id*='player' i]"
  );

  const stackedImages = Array.from(document.querySelectorAll("img")).filter((img) => {
    const rect = img.getBoundingClientRect();
    return rect.height > rect.width * 1.3 && rect.height > 300;
  });

  return {
    anime: hasVideo || hasPlayerClass || VIDEO_URL_HINTS.test(window.location.href),
    manga: stackedImages.length >= 5 || MANGA_URL_HINTS.test(window.location.href),
  };
}

function extractFromDocTitle(): string | null {
  const parts = document.title.split(/\s*[-|·–]\s*/).filter(Boolean);
  if (parts.length === 0) return null;
  return parts.reduce((longest, part) => (part.length > longest.length ? part : longest), parts[0]);
}

function extractTitle(): string | null {
  const ogTitle = document.querySelector<HTMLMetaElement>("meta[property='og:title']")?.content?.trim();
  const twitterTitle = document.querySelector<HTMLMetaElement>("meta[name='twitter:title']")?.content?.trim();
  const h1 = document.querySelector("h1")?.textContent?.trim();

  const candidate = ogTitle || twitterTitle || h1 || extractFromDocTitle();
  return candidate ? cleanTitle(candidate) : null;
}

function extractProgress(title: string): number | null {
  const fromTitle = extractChapterNumber(title);
  if (fromTitle) return fromTitle;

  const fromDocTitle = extractChapterNumber(document.title);
  if (fromDocTitle) return fromDocTitle;

  const urlNumbers = window.location.pathname.match(/(\d+(?:\.\d+)?)/g);
  if (urlNumbers && urlNumbers.length > 0) {
    return parseFloat(urlNumbers[urlNumbers.length - 1]);
  }

  return null;
}

export function detectGeneric(): GenericDetectionResult | null {
  const rawTitle = extractTitle();
  if (!rawTitle) return null;

  const progress = extractProgress(rawTitle);
  if (progress === null || isNaN(progress)) return null;

  const signals = detectMediaTypeSignals();
  const possibleTypes: MediaType[] = [];
  if (signals.anime) possibleTypes.push("ANIME");
  if (signals.manga) possibleTypes.push("MANGA");
  if (possibleTypes.length === 0) possibleTypes.push("MANGA", "ANIME");

  return {
    title: rawTitle,
    progress: Math.floor(progress),
    url: window.location.href,
    possibleTypes,
  };
}