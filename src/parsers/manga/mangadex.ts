import type { MediaDetection, SupportedSite } from "../../types";
import { cleanTitle } from "../utils";

export class MangaDexParser {
  site: SupportedSite = "mangadex";

  isChapterPage(): boolean {
    return /^\/chapter\/[0-9a-f-]{36}/.test(window.location.pathname);
  }

  detect(): MediaDetection | null {
    if (!this.isChapterPage()) return null;

    const titleEl = document.querySelectorAll<HTMLAnchorElement>("a[href*='/title/']")[1];
    const title = titleEl?.textContent?.trim() ?? null;

    const titleMatch = document.title.match(/Chapter\s+([\d]+(?:\.[\d]+)?)/i);
    const chapter = titleMatch ? parseFloat(titleMatch[1]) : null;

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