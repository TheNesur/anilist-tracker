import type { AniListMedia } from "../types";
import { normalizeForMatch } from "../shared/anilist-tracker-shared/index.js";

export function findExactMatch(
  detectedTitle: string,
  results: AniListMedia[]
): AniListMedia | null {
  const target = normalizeForMatch(detectedTitle);
  if (!target) return null;

  for (const media of results) {
    const candidates = [
      media.title.romaji,
      media.title.english,
      media.title.native,
      ...(media.synonyms ?? []),
    ];

    for (const candidate of candidates) {
      if (candidate && normalizeForMatch(candidate) === target) {
        return media;
      }
    }
  }

  return null;
}
