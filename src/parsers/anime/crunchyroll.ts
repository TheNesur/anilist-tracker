import type { MediaDetection, SupportedSite } from "../../types";
import { cleanTitle } from "../utils";

export class CrunchyrollParser {
  site: SupportedSite = "crunchyroll";

  isChapterPage(): boolean {
    if (!/\/watch\/[A-Z0-9]+/.test(window.location.pathname)) return false;
    const showTitle = document.querySelector("[class*='show-title']")?.textContent?.trim();
    const h1 = document.querySelector("h1")?.textContent?.trim();
    return !!(showTitle || h1);
  }

  detect(): MediaDetection | null {
    if (!/\/watch\/[A-Z0-9]+/.test(window.location.pathname)) return null;

    const title =
      document.querySelector<HTMLElement>("[class*='show-title']")?.textContent?.trim() ??
      this.extractTitleFromLdJson() ??
      this.extractTitleFromMeta() ??
      this.extractTitleFromDocTitle() ??
      null;

    let episode: number | null = null;

    const h1 = document.querySelector("h1")?.textContent?.trim() ?? "";
    const h1Match =
      h1.match(/^E(\d+)/i) ??
      h1.match(/episode\s*(\d+)/i) ??
      h1.match(/épisode\s*(\d+)/i);
    if (h1Match) episode = parseInt(h1Match[1], 10);

    if (!episode) {
      episode = this.extractEpisodeFromLdJson();
    }

    if (!episode) {
      const docTitleMatch =
        document.title.match(/E(?:p)?\.?\s*(\d+)/i) ??
        document.title.match(/episode\s*(\d+)/i) ??
        document.title.match(/épisode\s*(\d+)/i);
      if (docTitleMatch) episode = parseInt(docTitleMatch[1], 10);
    }

    if (!title || !episode) return null;

    return {
      title: cleanTitle(this.stripSeasonSuffix(title)),
      progress: episode,
      mediaType: "ANIME",
      source: this.site,
      url: window.location.href,
    };
  }

  private stripSeasonSuffix(title: string): string {
    return title
      .replace(/\s*\(Saison\s*\d+\)\s*$/i, "")
      .replace(/\s*\(Season\s*\d+\)\s*$/i, "")
      .replace(/\s*\|\s*E\d+.*$/i, "")
      .trim();
  }

  private extractTitleFromLdJson(): string | null {
    const scripts = document.querySelectorAll<HTMLScriptElement>("script[type='application/ld+json']");
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent ?? "");
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (item?.["@type"] === "TVEpisode" && typeof item?.name === "string") {
            const seriesName =
              item.partOfSeries?.name ??
              item.partOfSeason?.partOfSeries?.name ??
              null;
            if (seriesName) return seriesName;
            const beforePipe = item.name.split("|")[0]?.trim();
            if (beforePipe) return beforePipe;
          }
        }
      } catch {
        // ignore
      }
    }
    return null;
  }

  private extractEpisodeFromLdJson(): number | null {
    const scripts = document.querySelectorAll<HTMLScriptElement>("script[type='application/ld+json']");
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent ?? "");
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (item?.["@type"] === "TVEpisode") {
            const raw = item.episodeNumber;
            if (typeof raw === "number") return raw;
            if (raw) {
              const parsed = parseInt(String(raw), 10);
              if (!isNaN(parsed)) return parsed;
            }
            if (typeof item?.name === "string") {
              const m = item.name.match(/E(\d+)/i);
              if (m) return parseInt(m[1], 10);
            }
          }
        }
      } catch {
        // ignore
      }
    }
    return null;
  }

  private extractTitleFromMeta(): string | null {
    const ogTitle = document.querySelector<HTMLMetaElement>("meta[property='og:title']")?.content;
    if (!ogTitle) return null;
    return ogTitle.split("|")[0]?.trim() ?? ogTitle.trim();
  }

  private extractTitleFromDocTitle(): string | null {
    const t = document.title;
    return t.split(/\s*[-–]\s*Regardez sur Crunchyroll/i)[0]?.trim() ?? null;
  }
}