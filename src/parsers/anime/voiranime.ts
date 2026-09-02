import type { MediaDetection, SupportedSite } from "../../types";
import { cleanTitle, stripScanlationSuffix } from "../utils";

export class VoirAnimeParser {
  site: SupportedSite = "voiranime";

  isChapterPage(): boolean {
    const parts = window.location.pathname.split("/").filter(Boolean);
    return parts.length === 3 && parts[0] === "anime";
  }

  detect(): MediaDetection | null {
    if (!this.isChapterPage()) return null;

    const title = this.extractTitle();

    const episodeMatch = window.location.pathname.match(/-(\d+)-(?:vostfr|vf(?:-\d+)?)(?:\/)?$/i)
      ?? window.location.pathname.match(/-(\d+)\/?$/i);
    const episode = episodeMatch ? parseInt(episodeMatch[1], 10) : null;

    if (!title || episode === null || isNaN(episode)) return null;

    return {
      title: cleanTitle(stripScanlationSuffix(title)),
      progress: episode,
      mediaType: "ANIME",
      source: this.site,
      url: window.location.href,
    };
  }

  private extractTitle(): string | null {
    const slug = window.location.pathname.split("/").filter(Boolean)[1] ?? null;

    if (slug) {
      const seriesLink = document.querySelector<HTMLAnchorElement>(
        `.breadcrumb a[href*="/anime/${slug}/"], .breadcrumb a[href$="/anime/${slug}"], a.breadcrumb-item[href*="/anime/${slug}"]`
      );
      const linkTitle = seriesLink?.textContent?.trim();
      if (linkTitle) return linkTitle;
    }

    const heading = document.querySelector<HTMLElement>("h1.entry-title, .post-title h1, h1")?.textContent?.trim();
    if (heading) return heading;

    return this.extractTitleFromUrl();
  }

  private extractTitleFromUrl(): string | null {
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return parts[1]
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
}
