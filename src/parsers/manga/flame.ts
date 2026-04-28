import type { MediaDetection, SupportedSite } from "../../types";
import { cleanTitle, extractChapterNumber } from "../utils";

export class FlameParser {
  site: SupportedSite = "flame";

  isChapterPage(): boolean {
    const parts = window.location.pathname.split("/").filter(Boolean);
    return parts.length >= 3 && parts[0] === "manga";
  }

  detect(): MediaDetection | null {
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
      progress: Math.floor(chapter),
      mediaType: "MANGA",
      source: this.site,
      url: window.location.href,
    };
  }
}