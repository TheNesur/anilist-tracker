import type { MediaDetection, SupportedSite } from "../../types";
import { cleanTitle } from "../utils";

const RE_WATCH_PATH = /^\/watch\/[^/]+/;
const RE_EPISODE_LABEL = /(?:épisode|episode)\s*(\d+(?:\.\d+)?)/i;
const RE_WATCH_SLUG = /^\/watch\/([^/]+)/;
const RE_SEASON_FR = /\s+saison\s+(\d+)\s*$/i;

function toEpisode(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = parseFloat(value);
  return isNaN(parsed) || parsed < 0 ? null : Math.floor(parsed);
}

export class AniverseAnimeParser {
  site: SupportedSite = "aniverse";

  isChapterPage(): boolean {
    return RE_WATCH_PATH.test(window.location.pathname) && this.readEpisode() !== null;
  }

  detect(): MediaDetection | null {
    if (!RE_WATCH_PATH.test(window.location.pathname)) return null;

    const episode = this.readEpisode();
    const title = this.readTitle();
    if (episode === null || !title) return null;

    return {
      title: cleanTitle(title),
      progress: episode,
      mediaType: "ANIME",
      source: this.site,
      url: window.location.href,
    };
  }

  private readEpisode(): number | null {
    const fromUrl = toEpisode(new URLSearchParams(window.location.search).get("ep"));
    const label = document.querySelector("h1 span")?.textContent ?? "";
    const fromHeading = toEpisode(label.match(RE_EPISODE_LABEL)?.[1]);

    if (fromUrl !== null && fromHeading !== null && fromUrl !== fromHeading) return null;
    return fromUrl ?? fromHeading;
  }

  private readTitle(): string | null {
    const fromHeading = document.querySelector("h1 a")?.textContent?.replace(/\s+/g, " ").trim();
    if (fromHeading) return fromHeading.replace(RE_SEASON_FR, " Season $1");

    const slug = window.location.pathname.match(RE_WATCH_SLUG)?.[1];
    if (!slug) return null;
    return slug
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
}
