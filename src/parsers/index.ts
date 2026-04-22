import type { MangaDetection, SupportedSite } from "../types";

// ── Base parser interface ──
export interface SiteParser {
  site: SupportedSite;
  /** Check if we're on a chapter reading page */
  isChapterPage(): boolean;
  /** Extract manga title and chapter number */
  detect(): MangaDetection | null;
}

// ── Utility: extract a number from a string ──
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
// URL pattern: https://asuracomic.net/series/<slug>/chapter-<num>
export class AsuraParser implements SiteParser {
  site: SupportedSite = "asura";

  isChapterPage(): boolean {
    return /\/series\/.+\/chapter-\d+/i.test(window.location.pathname);
  }

  detect(): MangaDetection | null {
    if (!this.isChapterPage()) return null;

    // Try to get title from breadcrumb or heading
    const title =
      document.querySelector<HTMLElement>("h1.entry-title")?.textContent?.trim() ??
      document.querySelector<HTMLElement>("[class*='series-title']")?.textContent?.trim() ??
      document.querySelector<HTMLAnchorElement>("ol.breadcrumb li:nth-child(2) a")?.textContent?.trim() ??
      null;

    // Try chapter number from URL first, then from page content
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
      chapter: Math.floor(chapter), // AniList uses integers
      source: this.site,
      url: window.location.href,
    };
  }
}

// ── Flame Comics parser ──
// URL pattern: https://flamecomics.xyz/manga/<slug>/<chapter-slug>
export class FlameParser implements SiteParser {
  site: SupportedSite = "flame";

  isChapterPage(): boolean {
    // At least 3 path segments: /manga/<slug>/<chapter>
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
    // If there's a chapter navigation bar with current chapter, we're on a chapter page
    return !!document.querySelector("b.current-type-number");
  }

  detect(): MangaDetection | null {
    if (!this.isChapterPage()) return null;

    // Chapter number from the "Chapitre X" element
    const chapterEl = document.querySelector<HTMLElement>("b.current-type-number");
    const chapterText = chapterEl?.textContent?.trim() ?? "";
    const chapterMatch = chapterText.match(/(\d+)/);
    if (!chapterMatch) return null;
    const chapter = parseInt(chapterMatch[1], 10);

    // Title: try manga-title link first, then extract from page title
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
    // Format: "Title Chapter X | Read Manga Online | Raijin Scans"
    const pageTitle = document.title;
    const cleaned = pageTitle
      .replace(/\s*\|.*$/, "")                    // Remove everything after |
      .replace(/\s*(chapter|chapitre)\s*\d+.*/i, "") // Remove chapter info
      .replace(/\s*scan\s*vf.*/i, "")              // Remove "Scan VF..."
      .trim();
    return cleaned || null;
  }
}



// ── Title cleanup ──
function cleanTitle(raw: string): string {
  return raw
    .replace(/\s*(manga|manhwa|manhua|webtoon|comic)\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Factory: pick the right parser based on hostname ──
export function getParser(): SiteParser | null {
  const host = window.location.hostname.replace("www.", "");

  if (host.includes("asuracomic")) return new AsuraParser();
  if (host.includes("flamecomics")) return new FlameParser();
  if (host.includes("reaperscans")) return new ReaperParser();
  if (host.includes("raijin-scans") || host.includes("raijinscan"))  return new RaijinParser();

  return null;
}
