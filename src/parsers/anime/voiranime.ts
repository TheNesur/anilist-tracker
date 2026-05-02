import type { MediaDetection, SupportedSite } from "../../types";
import { cleanTitle } from "../utils";

export class VoirAnimeParser {
  site: SupportedSite = "voiranime";

  isChapterPage(): boolean {
    const parts = window.location.pathname.split("/").filter(Boolean);
    return parts.length === 3 && parts[0] === "anime";
  }

  detect(): MediaDetection | null {
    if (!this.isChapterPage()) return null;

    const titleEl = document.querySelector<HTMLAnchorElement>("a[href*='/anime/']");
    const title = titleEl?.textContent?.trim() ?? this.extractTitleFromUrl() ?? null;

    const episodeMatch = window.location.pathname.match(/-(\d+)-(?:vostfr|vf(?:-\d+)?)(?:\/)?$/i)
      ?? window.location.pathname.match(/-(\d+)\/?$/i);
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

  private extractTitleFromUrl(): string | null {
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return parts[1]
      .split("-")
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
}