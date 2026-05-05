import type { MediaDetection, SupportedSite } from "../../types";
import { cleanTitle, stripScanlationSuffix } from "../utils";

export class RaijinParser {
  site: SupportedSite = "raijin";

  isChapterPage(): boolean {
    return !!document.querySelector("b.current-type-number");
  }

  detect(): MediaDetection | null {
    if (!this.isChapterPage()) return null;

    const chapterEl = document.querySelector<HTMLElement>("b.current-type-number");
    const chapterText = chapterEl?.textContent?.trim() ?? "";
    const chapterMatch = chapterText.match(/(\d+)/);
    if (!chapterMatch) return null;
    const chapter = parseInt(chapterMatch[1], 10);

    const rawTitle =
      document.querySelector<HTMLAnchorElement>("a.manga-title")?.textContent?.trim() ??
      this.extractTitleFromPageTitle() ??
      null;

    if (!rawTitle || isNaN(chapter)) return null;

    return {
      title: cleanTitle(stripScanlationSuffix(rawTitle)),
      progress: chapter,
      mediaType: "MANGA",
      source: this.site,
      url: window.location.href,
    };
  }

  private extractTitleFromPageTitle(): string | null {
    const pageTitle = document.title;
    const cleaned = pageTitle
      .replace(/\s*\|.*$/, "")
      .replace(/\s*(chapter|chapitre)\s*\d+.*/i, "")
      .trim();
    return cleaned || null;
  }
}