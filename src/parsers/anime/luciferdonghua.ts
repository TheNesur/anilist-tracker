import type { MediaDetection, SupportedSite } from "../../types";
import {
  extractDonghuaEpisode,
  extractDonghuaTitle,
  isDonghuaEpisodePage,
} from "./animexin";

export class LuciferDonghuaParser {
  site: SupportedSite = "luciferdonghua";

  isChapterPage(): boolean {
    return isDonghuaEpisodePage();
  }

  detect(): MediaDetection | null {
    if (!this.isChapterPage()) return null;

    const title = extractDonghuaTitle();
    const episode = extractDonghuaEpisode();
    if (!title || episode === null) return null;

    return {
      title,
      progress: episode,
      mediaType: "ANIME",
      source: this.site,
      url: window.location.href,
    };
  }
}
