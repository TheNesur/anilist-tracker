import type { GenericDetectionResult } from "../types";

function injectedDetection(): GenericDetectionResult | null {
  function extractChapterNumber(text: string): number | null {
    const match = text.match(/(?:chapter|chapitre|ch\.?|ep\.?|episode|épisode)\s*([\d]+(?:\.[\d]+)?)/i);
    if (match) return parseFloat(match[1]);

    const numbers = text.match(/(\d+(?:\.\d+)?)/g);
    if (!numbers || numbers.length === 0) return null;

    const filtered = numbers.filter((n) => {
      if (/^(?:19|20)\d{2}$/.test(n)) return false;
      const idx = text.indexOf(n);
      if (idx > 0 && /v$/i.test(text.slice(Math.max(0, idx - 1), idx))) return false;
      return true;
    });

    if (filtered.length === 0) return null;
    return parseFloat(filtered[filtered.length - 1]);
  }

  const TYPE_WORDS = "manga|manhwa|manhua|webtoon|comic";

  function cleanTitle(raw: string): string {
    const cleaned = raw
      .replace(new RegExp(`^\\s*(${TYPE_WORDS})\\s+`, "i"), "")
      .replace(new RegExp(`\\s+(${TYPE_WORDS})\\s*$`, "i"), "")
      .replace(/\s+/g, " ")
      .trim();
    return cleaned || raw.trim();
  }

  const VIDEO_URL_HINTS = /episode|watch|player|streaming/i;
  const MANGA_URL_HINTS = /chapter|chapitre|read|scan|manga|manhwa|webtoon/i;

  function detectMediaTypeSignals() {
    const hasVideo = !!document.querySelector("video");
    const hasPlayerClass = !!document.querySelector("[class*='player' i], [id*='player' i]");

    let stacked = 0;
    const images = document.querySelectorAll("img");
    const limit = Math.min(images.length, 40);
    for (let i = 0; i < limit && stacked < 5; i++) {
      const rect = images[i].getBoundingClientRect();
      if (rect.height > rect.width * 1.3 && rect.height > 300) stacked++;
    }

    return {
      anime: hasVideo || hasPlayerClass || VIDEO_URL_HINTS.test(window.location.href),
      manga: stacked >= 5 || MANGA_URL_HINTS.test(window.location.href),
    };
  }

  function stripSiteSuffix(title: string): string {
    const [first] = title.split(/\s+[-|·–—]\s+/);
    return first?.trim() || title;
  }

  function stripScanlationSuffix(raw: string): string {
    return raw
      .replace(/\s*\((vf|vostfr|vostf|vo|raw|fr|en|es|de|jp|kr|cn|pt|it|ru|ar|tr)\)\s*$/i, "")
      .replace(/\s*\[(vf|vostfr|vostf|vo|raw|fr|en|es|de|jp|kr|cn|pt|it|ru|ar|tr|scan\s*vf|scan\s*fr)\]\s*$/i, "")
      .replace(/\s*[-–—:|]\s*(scan\s*)?(vf|vostfr|vostf|vo|raw|fr)\b.*$/i, "")
      .replace(/\s*[-–—:|]\s*(english|french|français|spanish|español|german|deutsch|japanese|korean|chinese|portuguese|italian|indonesian|thai|arabic|turkish|russian)\s*$/i, "")
      .replace(/\s+scan\s*(vf|vostfr|vostf|vo|fr)\s*.*$/i, "")
      .replace(/\s+(vf|vostfr|vostf)\s*$/i, "")
      .replace(/\s*\((scan|scanlation|traduction|translation|trad|fantrad|fan\s*trad)\b[^()]*\)\s*$/i, "")
      .trim();
  }

  function extractTitle(): string | null {
    const ogTitle = document.querySelector<HTMLMetaElement>("meta[property='og:title']")?.content?.trim();
    const twitterTitle = document.querySelector<HTMLMetaElement>("meta[name='twitter:title']")?.content?.trim();
    const h1 = document.querySelector("h1")?.textContent?.trim();
    const docTitle = document.title.trim() || null;
    const candidate = ogTitle || twitterTitle || h1 || docTitle;
    return candidate ? cleanTitle(stripScanlationSuffix(stripSiteSuffix(candidate))) : null;
  }

  function extractProgress(title: string): number | null {
    const fromTitle = extractChapterNumber(title);
    if (fromTitle !== null) return fromTitle;

    const fromDocTitle = extractChapterNumber(document.title);
    if (fromDocTitle !== null) return fromDocTitle;

    const urlNumbers = window.location.pathname.match(/(\d+(?:\.\d+)?)/g);
    if (urlNumbers && urlNumbers.length > 0) {
      return parseFloat(urlNumbers[urlNumbers.length - 1]);
    }

    return null;
  }

  const rawTitle = extractTitle();
  if (!rawTitle) return null;

  const progress = extractProgress(rawTitle);
  if (progress === null || isNaN(progress)) return null;

  const signals = detectMediaTypeSignals();
  const possibleTypes: ("MANGA" | "ANIME")[] = [];
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

export async function tryGenericDetection(tabId: number): Promise<GenericDetectionResult | null> {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: injectedDetection,
    });
    return (result?.result as GenericDetectionResult | null) ?? null;
  } catch {
    return null;
  }
}
