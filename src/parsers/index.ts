import type { MangaDetection, SupportedSite } from "../types";

export interface SiteParser {
  site: SupportedSite;
  isChapterPage(): boolean;
  detect(): MangaDetection | null;
}

function extractChapterNumber(text: string): number | null {
  // Matches patterns like "Chapter 123", "Ch. 45", "ch 6.5"
  const match = text.match(/(?:chapter|ch\.?)\s*([\d]+(?:\.[\d]+)?)/i);
  if (match) return parseFloat(match[1]);

  // Fallback: last number in the string
  const numbers = text.match(/(\d+(?:\.\d+)?)/g);
  if (numbers && numbers.length > 0) {
    return parseFloat(numbers[numbers.length - 1]);
  }

  return null;
}

// ── Asura Comics parser ──
export class AsuraParser implements SiteParser {
  site: SupportedSite = "asura";

  isChapterPage(): boolean {
    return /\/series\/.+\/chapter-\d+/i.test(window.location.pathname);
  }

  detect(): MangaDetection | null {
    if (!this.isChapterPage()) return null;

    const title =
      document.querySelector<HTMLElement>("h1.entry-title")?.textContent?.trim() ??
      document.querySelector<HTMLElement>("[class*='series-title']")?.textContent?.trim() ??
      document.querySelector<HTMLAnchorElement>("ol.breadcrumb li:nth-child(2) a")?.textContent?.trim() ??
      null;

    const urlMatch = window.location.pathname.match(/chapter-(\d+(?:\.\d+)?)/i);
    let chapter: number | null = urlMatch ? parseFloat(urlMatch[1]) : null;

    if (!chapter) {
      const chapterText =
        document.querySelector<HTMLElement>("[class*='chapter-num']")?.textContent ??
        document.title;
      chapter = extractChapterNumber(chapterText);
    }

    if (!title || !chapter) return null;

    return {
      title: cleanTitle(title),
      chapter: Math.floor(chapter),
      source: this.site,
      url: window.location.href,
    };
  }
}

// ── Flame Comics parser ──
export class FlameParser implements SiteParser {
  site: SupportedSite = "flame";

  isChapterPage(): boolean {
    const parts = window.location.pathname.split("/").filter(Boolean);
    return parts.length >= 3 && parts[0] === "manga";
  }

  detect(): MangaDetection | null {
    if (!this.isChapterPage()) return null;

    const title =
      document.querySelector<HTMLElement>("div.allc a")?.textContent?.trim() ??
      document.querySelector<HTMLAnchorElement>("ol.breadcrumb li:nth-child(2) a")?.textContent?.trim() ??
      null;

    const chapterText =
      document.querySelector<HTMLElement>(".entry-title")?.textContent ??
      document.title;
    const chapter = extractChapterNumber(chapterText);

    if (!title || !chapter) return null;

    return {
      title: cleanTitle(title),
      chapter: Math.floor(chapter),
      source: this.site,
      url: window.location.href,
    };
  }
}

// ── Reaper Scans parser ──
export class ReaperParser implements SiteParser {
  site: SupportedSite = "reaper";

  isChapterPage(): boolean {
    return /chapter/i.test(window.location.pathname);
  }

  detect(): MangaDetection | null {
    if (!this.isChapterPage()) return null;

    const title =
      document.querySelector<HTMLAnchorElement>("ol.breadcrumb li:nth-child(2) a")?.textContent?.trim() ??
      document.querySelector<HTMLElement>("[class*='series-title']")?.textContent?.trim() ??
      null;

    const chapter = extractChapterNumber(
      document.querySelector<HTMLElement>(".entry-title")?.textContent ??
        document.title
    );

    if (!title || !chapter) return null;

    return {
      title: cleanTitle(title),
      chapter: Math.floor(chapter),
      source: this.site,
      url: window.location.href,
    };
  }
}


// ── Raijin Scans parser ──
export class RaijinParser implements SiteParser {
  site: SupportedSite = "raijin";

  isChapterPage(): boolean {
    return !!document.querySelector("b.current-type-number");
  }

  detect(): MangaDetection | null {
    if (!this.isChapterPage()) return null;

    const chapterEl = document.querySelector<HTMLElement>("b.current-type-number");
    const chapterText = chapterEl?.textContent?.trim() ?? "";
    const chapterMatch = chapterText.match(/(\d+)/);
    if (!chapterMatch) return null;
    const chapter = parseInt(chapterMatch[1], 10);

    const title =
      document.querySelector<HTMLAnchorElement>("a.manga-title")?.textContent?.trim() ??
      this.extractTitleFromPageTitle() ??
      null;

    if (!title || isNaN(chapter)) return null;

    return {
      title: cleanTitle(title),
      chapter,
      source: this.site,
      url: window.location.href,
    };
  }

  private extractTitleFromPageTitle(): string | null {
    const pageTitle = document.title;
    const cleaned = pageTitle
      .replace(/\s*\|.*$/, "")                    // Remove everything after |
      .replace(/\s*(chapter|chapitre)\s*\d+.*/i, "") // Remove chapter info
      .replace(/\s*scan\s*vf.*/i, "")              // Remove "Scan VF..."
      .trim();
    return cleaned || null;
  }
}




// ── Webtoon parser ──
export class WebtoonParser implements SiteParser {
  site: SupportedSite = "webtoon";

  isChapterPage(): boolean {
    return /\/ep-?\d+\/viewer/.test(window.location.pathname);
  }

  detect(): MangaDetection | null {
    if (!this.isChapterPage()) return null;

    const title =
      document.querySelector<HTMLElement>(".subj")?.textContent?.trim() ?? null;

    // Matches both /ep20/viewer and /ep-21/viewer
    const urlMatch = window.location.pathname.match(/\/ep-?(\d+)\/viewer/i);
    const chapter = urlMatch ? parseInt(urlMatch[1], 10) : null;

    if (!title || !chapter) return null;

    return {
      title: cleanTitle(title),
      chapter,
      source: this.site,
      url: window.location.href,
    };
  }
}




















function cleanTitle(raw: string): string {
  return raw
    .replace(/\s*(manga|manhwa|manhua|webtoon|comic)\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getParser(): SiteParser | null {
  const host = window.location.hostname.replace("www.", "");

  if (host.includes("asuracomic")) return new AsuraParser();
  if (host.includes("flamecomics")) return new FlameParser();
  if (host.includes("reaperscans")) return new ReaperParser();
  if (host.includes("raijin-scans") || host.includes("raijinscan"))  return new RaijinParser();
  if (host.includes("webtoons")) return new WebtoonParser();
  
  return null;
}
