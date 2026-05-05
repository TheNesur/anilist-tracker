import type { MediaDetection, SupportedSite } from "../../types";
import { cleanTitle, stripScanlationSuffix } from "../utils";

export class WebtoonParser {
  site: SupportedSite = "webtoon";

  isChapterPage(): boolean {
    return /\/viewer/.test(window.location.pathname);
  }

  detect(): MediaDetection | null {
    if (!this.isChapterPage()) return null;

    const rawTitle =
      this.extractTitleFromBreadcrumb() ??
      document.querySelector<HTMLElement>(".subj")?.textContent?.trim() ??
      document.querySelector<HTMLElement>("h1.subj_info")?.textContent?.trim() ??
      this.extractTitleFromMeta() ??
      this.extractTitleFromUrl() ??
      null;

    const chapter = this.extractChapter();

    if (!rawTitle || !chapter) return null;

    const cleanedTitle = cleanTitle(
      stripScanlationSuffix(this.stripLocaleSuffix(rawTitle))
    );

    return {
      title: cleanedTitle,
      progress: chapter,
      mediaType: "MANGA",
      source: this.site,
      url: window.location.href,
    };
  }

  private extractChapter(): number | null {
    const search = window.location.search;
    const episodeNoMatch = search.match(/[?&]episode_no=(\d+)/i);
    if (episodeNoMatch) return parseInt(episodeNoMatch[1], 10);

    const path = window.location.pathname;
    const epMatch = path.match(/\/ep-?(\d+)\/viewer/i);
    if (epMatch) return parseInt(epMatch[1], 10);

    const titleMatch =
      document.title.match(/-\s*(\d+)\s*$/) ??
      document.title.match(/-\s*(\d+)\s*\|/) ??
      document.title.match(/Ep\.?\s*(\d+)/i) ??
      document.title.match(/#(\d+)/);
    if (titleMatch) return parseInt(titleMatch[1], 10);

    return null;
  }

  private extractTitleFromBreadcrumb(): string | null {
    const links = document.querySelectorAll<HTMLAnchorElement>("a[href*='/list?title_no=']");
    for (const link of links) {
      const text = link.textContent?.trim();
      if (text && text.length > 0) return text;
    }
    return null;
  }

  private extractTitleFromMeta(): string | null {
    const ogTitle = document.querySelector<HTMLMetaElement>("meta[property='og:title']")?.content?.trim();
    if (!ogTitle) return null;
    return ogTitle
      .replace(/\s*-\s*S\d+\s*Ep\.?\s*\d+.*$/i, "")
      .replace(/\s*-\s*Ep\.?\s*\d+.*$/i, "")
      .replace(/\s*-\s*\d+\s*$/, "")
      .replace(/\s*\|.*$/, "")
      .trim() || null;
  }

  private stripLocaleSuffix(title: string): string {
    return title
      .replace(/\s*\(EN\)\s*$/i, "")
      .replace(/\s*\(FR\)\s*$/i, "")
      .replace(/\s*\(ES\)\s*$/i, "")
      .replace(/\s*\(DE\)\s*$/i, "")
      .replace(/\s*\(ID\)\s*$/i, "")
      .replace(/\s*\(TH\)\s*$/i, "")
      .replace(/\s*\(ZH-HANT\)\s*$/i, "")
      .replace(/\s*-\s*S\d+\s*Ep\.?\s*\d+.*$/i, "")
      .replace(/\s*-\s*Ep\.?\s*\d+.*$/i, "")
      .replace(/\s*-\s*\d+\s*$/, "")
      .replace(/\s*\|.*$/, "")
      .trim();
  }

  private extractTitleFromUrl(): string | null {
    const parts = window.location.pathname.split("/").filter(Boolean);
    const titleSlug = parts.find(p =>
      !["fr", "en", "es", "de", "id", "th", "zh-hant"].includes(p) &&
      !/^(action|romance|comedy|drama|fantasy|thriller|sf|slice-of-life|sports|supernatural|mystery|tiptoon|heartwarming|historical)$/i.test(p) &&
      !/viewer/.test(p) &&
      !/^(ep-?|s\d+-e)\d+/i.test(p)
    );
    if (!titleSlug) return null;
    return titleSlug
      .split("-")
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
}