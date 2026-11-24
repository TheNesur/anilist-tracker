import type { AniListMedia } from "../types";
import { normalizeForMatch } from "../shared/anilist-tracker-shared/index.js";

const RE_SEASON_WORD = /\b(?:season|saison)\s+(\d+)\b/g;

function collapseSeasonWord(normalized: string): string {
  return normalized.replace(RE_SEASON_WORD, "$1");
}

export function findExactMatch(
  detectedTitle: string,
  results: AniListMedia[]
): AniListMedia | null {
  const detectedVariants = new Set<string>();
  detectedVariants.add(detectedTitle);

  const bracketMatches = Array.from(detectedTitle.matchAll(/[\[\(]([^\)\]]+)[\)\]]/g));
  for (const m of bracketMatches) {
    const inside = m[1].trim();
    if (inside.length >= 2) detectedVariants.add(inside);
  }

  const withoutBrackets = detectedTitle
    .replace(/[\[\(][^\)\]]+[\)\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (withoutBrackets.length >= 2) detectedVariants.add(withoutBrackets);

  for (const media of results) {
    const candidates = [
      media.title.romaji,
      media.title.english,
      media.title.native,
      ...(media.synonyms ?? []),
    ];

    for (const det of detectedVariants) {
      const target = normalizeForMatch(det);
      if (!target) continue;
      const targetCollapsed = collapseSeasonWord(target);
      const targetNoSpace = target.replace(/\s+/g, "");

      for (const candidate of candidates) {
        if (!candidate) continue;
        const norm = normalizeForMatch(candidate);
        if (!norm) continue;

        if (norm === target || collapseSeasonWord(norm) === targetCollapsed) {
          return media;
        }

        if (targetNoSpace.length >= 4 && norm.replace(/\s+/g, "") === targetNoSpace) {
          return media;
        }

        if (norm.length >= 5 && target.includes(norm)) {
          return media;
        }
      }
    }
  }

  return null;
}
