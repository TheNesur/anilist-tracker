import { normalizeForSearch } from "../shared/anilist-tracker-shared/index.js";

const TYPE_WORDS = "manga|manhwa|manhua|webtoon|comic";
const RE_TYPE_PREFIX = new RegExp(`^\\s*(${TYPE_WORDS})\\s+`, "i");
const RE_TYPE_SUFFIX = new RegExp(`\\s+(${TYPE_WORDS})\\s*$`, "i");

const RE_CHAPTER_KEYWORD = /(?:chapter|chapitre|ch\.?|ep\.?|episode|épisode)\s*([\d]+(?:\.[\d]+)?)/i;
const RE_VERSIONED = /\bv\d+$/i;
const RE_YEAR = /^(?:19|20)\d{2}$/;
const RE_SEASON_NUM = /\b(?:s|season|saison)\s*\d+$/i;
const RE_ALL_NUMBERS = /(\d+(?:\.\d+)?)/g;

export function extractChapterNumber(text: string): number | null {
  const match = text.match(RE_CHAPTER_KEYWORD);
  if (match) return parseFloat(match[1]);

  const numbers = text.match(RE_ALL_NUMBERS);
  if (!numbers || numbers.length === 0) return null;

  const filtered = numbers.filter((n) => {
    if (RE_YEAR.test(n)) return false;
    const idx = text.indexOf(n);
    if (idx > 0 && /v$/i.test(text.slice(Math.max(0, idx - 1), idx))) return false;
    return true;
  });

  if (filtered.length === 0) return null;
  return parseFloat(filtered[filtered.length - 1]);
}

export function cleanTitle(raw: string): string {
  const cleaned = raw
    .replace(RE_TYPE_PREFIX, "")
    .replace(RE_TYPE_SUFFIX, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || raw.trim();
}

const RE_LANG_PARENS = /\s*\((vf|vostfr|vostf|vo|raw|fr|en|es|de|jp|kr|cn|pt|it|ru|ar|tr)\)\s*$/i;
const RE_LANG_BRACKETS = /\s*\[(vf|vostfr|vostf|vo|raw|fr|en|es|de|jp|kr|cn|pt|it|ru|ar|tr|scan\s*vf|scan\s*fr)\]\s*$/i;
const RE_SEPARATOR_LANG = /\s*[-–—:|]\s*(scan\s*)?(vf|vostfr|vostf|vo|raw|fr)\b.*$/i;
const RE_SEPARATOR_FULL_LANG = /\s*[-–—:|]\s*(english|french|français|spanish|español|german|deutsch|japanese|korean|chinese|portuguese|italian|indonesian|thai|arabic|turkish|russian)\s*$/i;
const RE_SCAN_SUFFIX = /\s+scan\s*(vf|vostfr|vostf|vo|fr)\s*.*$/i;
const RE_TRAILING_LANG = /\s+(vf|vostfr|vostf)\s*$/i;
const RE_SCANLATION_PARENS = /\s*\((scan|scanlation|traduction|translation|trad|fantrad|fan\s*trad)\b[^()]*\)\s*$/i;

export function stripScanlationSuffix(raw: string): string {
  return raw
    .replace(RE_LANG_PARENS, "")
    .replace(RE_LANG_BRACKETS, "")
    .replace(RE_SEPARATOR_LANG, "")
    .replace(RE_SEPARATOR_FULL_LANG, "")
    .replace(RE_SCAN_SUFFIX, "")
    .replace(RE_TRAILING_LANG, "")
    .replace(RE_SCANLATION_PARENS, "")
    .trim();
}

const RE_SEASON_SUFFIX_PARENS = /\s*\((?:Season|Saison)\s*\d+\)\s*$/i;
const RE_SEASON_SUFFIX_BARE = /\s+(?:Season|Saison)\s+\d+\s*$/i;
const RE_SEASON_ORDINAL = /\s+\d+(?:st|nd|rd|th)\s+Season\s*$/i;
const RE_SEASON_FINAL = /\s+Final\s+Season(?:\s+Part\s+\d+)?\s*$/i;
const RE_SEASON_PART = /\s+Part\s+\d+\s*$/i;
const RE_SEASON_COUR = /\s+Cour\s+\d+\s*$/i;
const RE_PIPE_EPISODE = /\s*\|\s*E\d+.*$/i;

export function stripSeasonSuffix(title: string): string {
  return title
    .replace(RE_SEASON_SUFFIX_PARENS, "")
    .replace(RE_SEASON_ORDINAL, "")
    .replace(RE_SEASON_FINAL, "")
    .replace(RE_SEASON_SUFFIX_BARE, "")
    .replace(RE_SEASON_PART, "")
    .replace(RE_SEASON_COUR, "")
    .replace(RE_PIPE_EPISODE, "")
    .trim();
}

export { normalizeForSearch as normalizeSearchTitle };
