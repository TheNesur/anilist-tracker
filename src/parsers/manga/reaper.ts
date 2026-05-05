import type { MediaDetection, SupportedSite } from "../../types";
import { cleanTitle, extractChapterNumber, stripScanlationSuffix } from "../utils";

export class ReaperParser {
  site: SupportedSite = "reaper";

  isChapterPage(): boolean {
    return /^\/series\/[^/]+\/[^/]*chapter[^/]*\d/i.test(window.location.pathname);
  }

  detect(): MediaDetection | null {
    if (!this.isChapterPage()) return null;

    const rawTitle =
      document.querySelector<HTMLAnchorElement>("ol.breadcrumb li:nth-child(2) a")?.textContent?.trim() ??
      document.querySelector<HTMLElement>("[class*='series-title']")?.textContent?.trim() ??
      this.extractTitleFromUrl() ??
      null;

    const chapter = extractChapterNumber(
      document.querySelector<HTMLElement>(".entry-title")?.textContent ??
        document.title
    );

    if (!rawTitle || !chapter) return null;

    return {
      title: cleanTitle(stripScanlationSuffix(rawTitle)),
      progress: Math.floor(chapter),
      mediaType: "MANGA",
      source: this.site,
      url: window.location.href,
    };
  }

  private extractTitleFromUrl(): string | null {
    const match = window.location.pathname.match(/^\/series\/([^/]+)/);
    if (!match) return null;
    return match[1]
      .replace(/-/g, " ")
      .split(" ")
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
}