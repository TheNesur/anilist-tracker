import type { MediaDetection, SupportedSite } from "../../types";
import { cleanTitle } from "../utils";

export class WebtoonParser {
  site: SupportedSite = "webtoon";

  isChapterPage(): boolean {
    return /\/ep-?\d+\/viewer/.test(window.location.pathname);
  }

  detect(): MediaDetection | null {
    if (!this.isChapterPage()) return null;

    const title =
      document.querySelector<HTMLElement>(".subj")?.textContent?.trim() ?? null;

    const urlMatch = window.location.pathname.match(/\/ep-?(\d+)\/viewer/i);
    const chapter = urlMatch ? parseInt(urlMatch[1], 10) : null;

    if (!title || !chapter) return null;

    return {
      title: cleanTitle(title),
      progress: chapter,
      mediaType: "MANGA",
      source: this.site,
      url: window.location.href,
    };
  }
}