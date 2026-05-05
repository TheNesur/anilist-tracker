import type { MediaDetection, SupportedSite } from "../../types";
import { cleanTitle } from "../utils";

export class MangaDexParser {
  site: SupportedSite = "mangadex";

  isChapterPage(): boolean {
    return /^\/chapter\/[0-9a-f-]{36}/.test(window.location.pathname);
  }

  detect(): MediaDetection | null {
    if (!this.isChapterPage()) return null;

    const rawTitle =
      this.extractTitleFromDocTitle() ??
      this.extractTitleFromMeta() ??
      this.extractTitleFromLinks() ??
      null;

    const titleMatch =
      document.title.match(/Chapter\s+([\d]+(?:\.[\d]+)?)/i) ??
      document.title.match(/Ch\.\s*([\d]+(?:\.[\d]+)?)/i) ??
      document.title.match(/^([\d]+(?:\.[\d]+)?)\s*\|/);
    const chapter = titleMatch ? parseFloat(titleMatch[1]) : null;

    if (!rawTitle || !chapter) return null;

    return {
      title: cleanTitle(rawTitle),
      progress: Math.floor(chapter),
      mediaType: "MANGA",
      source: this.site,
      url: window.location.href,
    };
  }

  private extractTitleFromDocTitle(): string | null {
    const t = document.title;
    const match = t.match(/^[\d.]+\s*\|\s*Chapter\s+[\d.]+\s*-\s*(.+?)\s*-\s*MangaDex\s*$/i);
    if (match) return match[1].trim();

    const altMatch = t.match(/^Chapter\s+[\d.]+\s*-\s*(.+?)\s*-\s*MangaDex\s*$/i);
    if (altMatch) return altMatch[1].trim();

    const dashMatch = t.match(/^.+?\s*-\s*(.+?)\s*-\s*MangaDex\s*$/i);
    if (dashMatch) return dashMatch[1].trim();

    return null;
  }

  private extractTitleFromMeta(): string | null {
    const ogTitle = document.querySelector<HTMLMetaElement>("meta[property='og:title']")?.content?.trim();
    if (!ogTitle) return null;
    const cleaned = ogTitle
      .replace(/\s*-\s*MangaDex\s*$/i, "")
      .replace(/^\d+\s*\|\s*/, "")
      .replace(/\s*-\s*Chapter\s+[\d.]+\s*/i, "")
      .replace(/\s*-\s*Ch\.\s*[\d.]+\s*/i, "")
      .trim();
    return cleaned || null;
  }

  private extractTitleFromLinks(): string | null {
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href*='/title/']"));
    if (links.length >= 2) {
      const second = links[1].textContent?.trim();
      if (second && second.length > 1) return second;
    }
    for (const link of links) {
      const text = link.textContent?.trim();
      if (text && text.length > 1 && !/^chapter|^ch\.|^vol\./i.test(text)) {
        return text;
      }
    }
    return null;
  }
}