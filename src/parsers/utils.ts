export function extractChapterNumber(text: string): number | null {
  const match = text.match(/(?:chapter|ch\.?)\s*([\d]+(?:\.[\d]+)?)/i);
  if (match) return parseFloat(match[1]);

  const numbers = text.match(/(\d+(?:\.\d+)?)/g);
  if (numbers && numbers.length > 0) {
    return parseFloat(numbers[numbers.length - 1]);
  }

  return null;
}

export function cleanTitle(raw: string): string {
  return raw
    .replace(/\s*(manga|manhwa|manhua|webtoon|comic)\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}