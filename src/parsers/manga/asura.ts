import type { MediaDetection, SupportedSite } from "../../types";
import { cleanTitle, extractChapterNumber } from "../utils";

export class AsuraParser {
  site: SupportedSite = "asura";

  isChapterPage(): boolean {
    return /\/series\/.+\/chapter-\d+/i.test(window.location.pathname);
  }

  detect(): MediaDetection | null {
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
      progress: Math.floor(chapter),
      mediaType: "MANGA",
      source: this.site,
      url: window.location.href,
    };
  }
}