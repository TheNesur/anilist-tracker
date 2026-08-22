import type { MediaDetection, SupportedSite } from "../../types";
import { cleanTitle } from "../utils";

let listenersBound = false;

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

    const extractEpisodeNumber = (select: HTMLSelectElement): number | null => {
      const option = select.children[select.selectedIndex] as HTMLOptionElement | undefined;
      if (!option) return null;
      const parts = option.innerText.split(" ");
      const value = Number(parts[1]);
      return isNaN(value) ? null : value;
    };

    if (!listenersBound) {
      listenersBound = true;
      const updateProgress = () => {
        const currentSelect = document.getElementById("selectEpisodes") as HTMLSelectElement | null;
        if (!currentSelect) return;
        const episode = extractEpisodeNumber(currentSelect);
        if (episode === null) return;

        chrome.runtime.sendMessage({
          type: "LOCAL_UPDATE_PROGRESS",
          payload: { progress: episode },
        });
      };

      episodeEl?.addEventListener('change', updateProgress);
      document.getElementById('nextEpisode')?.addEventListener('click', updateProgress);
      document.getElementById('lastEpisode')?.addEventListener('click', updateProgress);
      document.getElementById('prevEpisode')?.addEventListener('click', updateProgress);
    }

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
    return parts[1]?.replace(/-/g, " ") ?? null;
  }
}
