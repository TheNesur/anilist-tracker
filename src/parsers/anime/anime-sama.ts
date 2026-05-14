import type { MediaDetection, SupportedSite } from "../../types";
import { cleanTitle } from "../utils";

export class AnimeSamaParser {
  site: SupportedSite = "anime-sama";

  isChapterPage(): boolean {
    const parts = window.location.pathname.split("/").filter(Boolean);
    return parts.length >= 3 && parts[0] === "catalogue" && parts[2].match(/^saison\d+$/) !== null;
  }

  detect(): MediaDetection | null {
    if (!this.isChapterPage()) return null;

    const titleEl = document.getElementById('titreOeuvre');
    const title = titleEl?.textContent?.trim() ?? this.extractTitleFromUrl() ?? null;

    const episodeEl: HTMLSelectElement | null = document.getElementById("selectEpisodes") as HTMLSelectElement;
    const episodeOption: HTMLOptionElement | null = episodeEl?.children[episodeEl.selectedIndex] as HTMLOptionElement;
    const episode = Number(episodeOption.innerText.split(" ")[1]);

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
    return parts[1].replace("-", " ");
  }
}