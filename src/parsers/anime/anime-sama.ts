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

    const episodeEl = document.getElementById("selectEpisodes") as HTMLSelectElement | null;
    const nextEpisodeEl = document.getElementById('nextEpisode') as HTMLButtonElement | null;
    const lastEpisodeEl = document.getElementById('lastEpisode') as HTMLButtonElement | null;
    const prevEpisodeEl = document.getElementById('prevEpisode') as HTMLButtonElement | null;

    const extractEpisodeNumber = (select: HTMLSelectElement): number | null => {
      const option = select.children[select.selectedIndex] as HTMLOptionElement | undefined;
      if (!option) return null;
      const parts = option.innerText.split(" ");
      const value = Number(parts[1]);
      return isNaN(value) ? null : value;
    };

    const updateProgress = () => {
      const currentSelect = document.getElementById("selectEpisodes") as HTMLSelectElement | null;
      if (!currentSelect) return;
      const episode = extractEpisodeNumber(currentSelect);
      if (episode === null) return;

      chrome.runtime.sendMessage({
        type: "LOCAL_UPDATE_PROGRESS",
        payload: {
          progress: episode
        },
      });
    };

    episodeEl?.addEventListener('change', updateProgress);
    nextEpisodeEl?.addEventListener('click', updateProgress);
    lastEpisodeEl?.addEventListener('click', updateProgress);
    prevEpisodeEl?.addEventListener('click', updateProgress);

    if (!episodeEl) return null;
    const episode = extractEpisodeNumber(episodeEl);

    if (!title || episode === null) return null;

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
    return parts[1]?.replace("-", " ") ?? null;
  }
}