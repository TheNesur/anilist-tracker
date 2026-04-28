import type { MediaDetection, SupportedSite } from "../../types";
import { cleanTitle } from "../utils";

export class CrunchyrollParser {
  site: SupportedSite = "crunchyroll";

  isChapterPage(): boolean {
    return /\/watch\/[A-Z0-9]+\//.test(window.location.pathname);
  }

  detect(): MediaDetection | null {
    if (!this.isChapterPage()) return null;

    const title =
      document.querySelector<HTMLElement>("[class*='show-title']")?.textContent?.trim() ??
      this.extractTitleFromMeta() ??
      null;

    const h1 = document.querySelector("h1")?.textContent?.trim() ?? "";
    const episodeMatch = h1.match(/^E(\d+)/i);
    const episode = episodeMatch ? parseInt(episodeMatch[1], 10) : null;

    if (!title || !episode) return null;

    return {
      title: cleanTitle(title),
      progress: episode,
      mediaType: "ANIME",
      source: this.site,
      url: window.location.href,
    };
  }

  private extractTitleFromMeta(): string | null {
    const ogTitle = document.querySelector("meta[property='og:title']")?.getAttribute("content");
    if (!ogTitle) return null;
    const match = ogTitle.match(/^(.+?)\s*[\|:]/);
    return match ? match[1].trim() : null;
  }
}