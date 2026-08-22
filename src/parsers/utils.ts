import { normalizeForSearch } from "../shared/anilist-tracker-shared/index.js";

const TYPE_WORDS = "manga|manhwa|manhua|webtoon|comic";
const RE_TYPE_PREFIX = new RegExp(`^\\s*(${TYPE_WORDS})\\s+`, "i");
const RE_TYPE_SUFFIX = new RegExp(`\\s+(${TYPE_WORDS})\\s*$`, "i");

const RE_CHAPTER_KEYWORD = /(?:chapter|chapitre|ch\.?|ep|episode|épisode)\s*([\d]+(?:\.[\d]+)?)/i;
const RE_ALL_NUMBERS = /(\d+(?:\.\d+)?)/g;

export function extractChapterNumber(text: string): number | null {
  const match = text.match(RE_CHAPTER_KEYWORD);
  if (match) return parseFloat(match[1]);

  const numbers = text.match(RE_ALL_NUMBERS);
  if (numbers && numbers.length > 0) {
    return parseFloat(numbers[numbers.length - 1]);
  }

  return null;
}

export function cleanTitle(raw: string): string {
  return raw
    .replace(RE_TYPE_PREFIX, "")
    .replace(RE_TYPE_SUFFIX, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripScanlationSuffix(raw: string): string {
  return raw
    .replace(/\s*\((vf|vostfr|vostf|vo|raw|fr|en|es|de|jp|kr|cn)\)\s*$/i, "")
    .replace(/\s*[-–—:|]\s*(scan\s*)?(vf|vostfr|vostf|vo|raw|fr)\b.*$/i, "")
    .replace(/\s+scan\s*(vf|vostfr|vostf|vo|fr)\s*.*$/i, "")
    .replace(/\s+(vf|vostfr|vostf)\s*$/i, "")
    .replace(/\s*\([^()]*\)\s*$/, "")
    .trim();
}

export { normalizeForSearch as normalizeSearchTitle };
