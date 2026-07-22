export function extractChapterNumber(text: string): number | null {
  const match = text.match(/(?:chapter|chapitre|ch\.?|ep|episode|épisode)\s*([\d]+(?:\.[\d]+)?)/i);
  if (match) return parseFloat(match[1]);

  const numbers = text.match(/(\d+(?:\.\d+)?)/g);
  if (numbers && numbers.length > 0) {
    return parseFloat(numbers[numbers.length - 1]);
  }

  return null;
}

const TYPE_WORDS = "manga|manhwa|manhua|webtoon|comic";

export function cleanTitle(raw: string): string {
  return raw
    .replace(new RegExp(`^\\s*(${TYPE_WORDS})\\s+`, "i"), "")
    .replace(new RegExp(`\\s+(${TYPE_WORDS})\\s*$`, "i"), "")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripScanlationSuffix(raw: string): string {
  return raw
    .replace(/\s*\((vf|vostfr|vostf|vo|raw|fr|en|es|de|jp|kr|cn)\)\s*$/i, "")
    .replace(/\s*[-–—:|]\s*(scan\s*)?(vf|vostfr|vostf|vo|raw|fr)\b.*$/i, "")
    .replace(/\s+scan\s*(vf|vostfr|vostf|vo|fr)\s*.*$/i, "")
    .trim();
}

export function normalizeSearchTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['\u2018\u2019\u02BC`]/g, "")   
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


