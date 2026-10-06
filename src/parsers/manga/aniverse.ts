import type { MediaDetection, SupportedSite } from "../../types";
import { cleanTitle, extractChapterNumber, stripChapterSuffix, stripScanlationSuffix } from "../utils";

export class AniverseParser {
  site: SupportedSite = "aniverse";

  isChapterPage(): boolean {
    return /^\/read\//.test(window.location.pathname) && this.readHeading() !== null;
  }

  detect(): MediaDetection | null {
    if (!this.isChapterPage()) return null;

    const heading = this.readHeading();
    if (!heading) return null;

    const chapter = extractChapterNumber(heading);
    if (chapter === null) return null;

    const title = cleanTitle(stripScanlationSuffix(stripChapterSuffix(heading)));
    if (!title) return null;

    return {
      title,
      progress: Math.floor(chapter),
      mediaType: "MANGA",
      source: this.site,
      url: window.location.href,
    };
  }

  private readHeading(): string | null {
    const text = document.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim();
    if (!text || !/(?:chapitre|chapter)\s*\d/i.test(text)) return null;
    return text;
  }
}
