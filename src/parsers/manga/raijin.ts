import type { MediaDetection, SupportedSite } from "../../types";
import { cleanTitle, extractChapterNumber, stripScanlationSuffix } from "../utils";

export class RaijinParser {
  site: SupportedSite = "raijin";

  isChapterPage(): boolean {
    return !!document.querySelector("b.current-type-number");
  }

  detect(): MediaDetection | null {
    if (!this.isChapterPage()) return null;

    const chapterEl = document.querySelector<HTMLElement>("b.current-type-number");
    const chapter = extractChapterNumber(chapterEl?.textContent?.trim() ?? "");
    if (chapter === null) return null;

    const rawTitle =
      document.querySelector<HTMLAnchorElement>("a.manga-title")?.textContent?.trim() ??
      this.extractTitleFromPageTitle() ??
      null;

    if (!rawTitle) return null;

    return {
      title: cleanTitle(stripScanlationSuffix(rawTitle)),
      progress: Math.floor(chapter),
      mediaType: "MANGA",
      source: this.site,
      url: window.location.href,
    };
  }

  private extractTitleFromPageTitle(): string | null {
    const cleaned = document.title
      .replace(/\s*\|.*$/, "")
      .replace(/\s*(chapter|chapitre)\s*\d+.*/i, "")
      .trim();
    return cleaned || null;
  }
}
