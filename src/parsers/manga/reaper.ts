import type { MediaDetection, SupportedSite } from "../../types";
import { cleanTitle, extractChapterNumber } from "../utils";

export class ReaperParser {
  site: SupportedSite = "reaper";

  isChapterPage(): boolean {
    return /chapter/i.test(window.location.pathname);
  }

  detect(): MediaDetection | null {
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
      progress: Math.floor(chapter),
      mediaType: "MANGA",
      source: this.site,
      url: window.location.href,
    };
  }
}