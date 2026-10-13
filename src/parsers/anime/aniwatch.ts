import type { MediaDetection, SupportedSite } from "../../types";
import { cleanTitle } from "../utils";

const RE_EPISODE_PATH = /^\/episode\/.+-(\d+)-[a-z0-9]+\/?$/i;
const RE_EPISODE_SLUG = /^(.+)-\d+-[a-z0-9]+$/i;
const RE_MOVIE_PATH = /^\/[a-z0-9]+-watch-(.+?)\/?$/i;

export class AniwatchParser {
  site: SupportedSite = "aniwatch";

  isChapterPage(): boolean {
    return this.isEpisodePage() || this.isMoviePage();
  }

  detect(): MediaDetection | null {
    if (!this.isChapterPage()) return null;

    const title = this.isMoviePage() ? this.extractMovieTitle() : this.extractEpisodeTitle();
    const episode = this.isMoviePage() ? 1 : this.extractEpisode();

    if (!title || episode === null) return null;

    return {
      title: cleanTitle(title),
      progress: episode,
      mediaType: "ANIME",
      source: this.site,
      url: window.location.href,
    };
  }

  private isEpisodePage(): boolean {
    return RE_EPISODE_PATH.test(window.location.pathname);
  }

  private isMoviePage(): boolean {
    return RE_MOVIE_PATH.test(window.location.pathname);
  }

  private extractEpisode(): number | null {
    const match = window.location.pathname.match(RE_EPISODE_PATH);
    const fromUrl = match ? parseInt(match[1], 10) : NaN;
    if (!isNaN(fromUrl) && fromUrl > 0) return fromUrl;

    const active = document.querySelector<HTMLElement>(".ws-ep--active[data-episode]")?.dataset.episode;
    const fromList = active ? parseInt(active, 10) : NaN;
    return !isNaN(fromList) && fromList > 0 ? fromList : null;
  }

  private extractEpisodeTitle(): string | null {
    const names = document.querySelectorAll<HTMLElement>('.breadcrumb a[href*="/anime/"] [itemprop="name"]');
    const fromBreadcrumb = names[names.length - 1]?.textContent?.trim();
    if (fromBreadcrumb) return fromBreadcrumb;

    const slug = window.location.pathname.split("/").filter(Boolean)[1] ?? "";
    return this.humanizeSlug(slug.match(RE_EPISODE_SLUG)?.[1]);
  }

  private extractMovieTitle(): string | null {
    const fromBreadcrumb = document
      .querySelector<HTMLElement>('.breadcrumb [itemprop="name"][aria-current="page"]')
      ?.textContent?.trim();
    if (fromBreadcrumb) return fromBreadcrumb;

    return this.humanizeSlug(window.location.pathname.match(RE_MOVIE_PATH)?.[1]);
  }

  private humanizeSlug(slug: string | undefined): string | null {
    if (!slug) return null;
    return slug
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
}
