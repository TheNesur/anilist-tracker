import type { MediaDetection, SupportedSite } from "../../types";
import { cleanTitle } from "../utils";

export class MangaPlusParser {
  site: SupportedSite = "mangaplus";

  isChapterPage(): boolean {
    return /^\/viewer\/\d+/.test(window.location.pathname);
  }

  detect(): MediaDetection | null {
    if (!this.isChapterPage()) return null;

    const titleMatch = document.title.match(/^\[#(\d+)\]\s+(.+?)\s+\|\s+MANGA Plus$/i);
    if (!titleMatch) return null;

    const chapter = parseInt(titleMatch[1], 10);
    const title = titleMatch[2].trim();

    if (!title || isNaN(chapter)) return null;

    return {
      title: cleanTitle(title),
      progress: chapter,
      mediaType: "MANGA",
      source: this.site,
      url: window.location.href,
    };
  }
}