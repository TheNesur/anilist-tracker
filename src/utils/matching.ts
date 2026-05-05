import type { AniListMedia } from "../types";

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function findExactMatch(
  detectedTitle: string,
  results: AniListMedia[]
): AniListMedia | null {
  const target = normalize(detectedTitle);
  if (!target) return null;

  for (const media of results) {
    const candidates = [
      media.title.romaji,
      media.title.english,
      media.title.native,
      ...(media.synonyms ?? []),
    ];

    for (const candidate of candidates) {
      if (candidate && normalize(candidate) === target) {
        return media;
      }
    }
  }

  return null;
}