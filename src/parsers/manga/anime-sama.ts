import type { MediaDetection, SupportedSite } from "../../types";
import { cleanTitle, extractChapterNumber } from "../utils";

let listenersBound = false;

export class AnimeSamaMangaParser {
  site: SupportedSite = "anime-sama";

  isChapterPage(): boolean {
    const parts = window.location.pathname.split("/").filter(Boolean);
    return parts.length >= 4 && parts[0] === "catalogue" && parts[2] === "scan";
  }

  detect(): MediaDetection | null {
    if (!this.isChapterPage()) return null;

    const titleEl = document.getElementById('titreOeuvre');
    const title = titleEl?.textContent?.trim() ?? this.extractTitleFromUrl() ?? null;

    const selectEl = document.getElementById("selectChapitres") as HTMLSelectElement | null;

    const extractChapterFromSelect = (select: HTMLSelectElement): number | null => {
      const option = select.children[select.selectedIndex] as HTMLOptionElement | undefined;
      if (!option) return null;
      return extractChapterNumber(option.textContent ?? "");
    };

    if (!listenersBound) {
      listenersBound = true;
      const updateProgress = () => {
        const currentSelect = document.getElementById("selectChapitres") as HTMLSelectElement | null;
        if (!currentSelect) return;
        const chapter = extractChapterFromSelect(currentSelect);
        if (chapter === null) return;

        chrome.runtime.sendMessage({
          type: "LOCAL_UPDATE_PROGRESS",
          payload: { progress: Math.floor(chapter) },
        });
      };

      selectEl?.addEventListener('change', updateProgress);
      document.querySelectorAll<HTMLButtonElement>('[id="prevChapitre"]').forEach(btn => btn.addEventListener('click', updateProgress));
      document.querySelectorAll<HTMLButtonElement>('[id="lastChapitre"]').forEach(btn => btn.addEventListener('click', updateProgress));
      document.querySelectorAll<HTMLButtonElement>('[id="nextChapitre"]').forEach(btn => btn.addEventListener('click', updateProgress));
    }

    if (!selectEl) return null;
    const chapter = extractChapterFromSelect(selectEl);

    if (!title || chapter === null) return null;

    return {
      title: cleanTitle(title),
      progress: Math.floor(chapter),
      mediaType: "MANGA",
      source: this.site,
      url: window.location.href,
    };
  }

  private extractTitleFromUrl(): string | null {
    const parts = window.location.pathname.split("/").filter(Boolean);
    return parts[1]?.replace(/-/g, " ") ?? null;
  }
}
