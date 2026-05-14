import type { AniListMedia, MediaDetection, SupportedSite } from "../../types";
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
    const nextEpisodeEl = document.getElementById('nextEpisode') as HTMLButtonElement;
    const lastEpisodeEl = document.getElementById('lastEpisode') as HTMLButtonElement;
    const prevEpisodeEl = document.getElementById('prevEpisode') as HTMLButtonElement;

    function updateProgress() {
        const episodeSelect = document.getElementById("selectEpisodes") as HTMLSelectElement
        const episodeOption = episodeSelect.children[episodeSelect.selectedIndex] as HTMLOptionElement;
        const episode = Number(episodeOption.innerText.split(" ")[1]);

        chrome.runtime.sendMessage({
            type: "LOCAL_UPDATE_PROGRESS",
            payload: {
                progress: episode
            },
        });
    }
    
    episodeEl.addEventListener('change', updateProgress);
    nextEpisodeEl.addEventListener('click', updateProgress);
    lastEpisodeEl.addEventListener('click', updateProgress);
    prevEpisodeEl.addEventListener('click', updateProgress);

    const episodeOption = episodeEl?.children[episodeEl.selectedIndex] as HTMLOptionElement;
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