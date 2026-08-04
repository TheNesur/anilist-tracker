import type { CatalogEntry, CatalogParser, SupportedSite } from "../../types";
import { cleanTitle, extractChapterNumber, stripScanlationSuffix } from "../utils";

export class RaijinCatalogParser implements CatalogParser {
  site: SupportedSite = "raijin";

  isCatalogPage(): boolean {
    return !!document.querySelector("#recently-up-ajax");
  }

  detectEntries(): CatalogEntry[] {
    if (!this.isCatalogPage()) return [];

    const units = document.querySelectorAll<HTMLElement>("#recently-up-ajax .unit");
    const entries: CatalogEntry[] = [];

    units.forEach((unit) => {
      const titleLink = unit.querySelector<HTMLAnchorElement>(".info > a");
      const title = titleLink?.textContent?.trim();
      if (!title || !titleLink) return;

      const chNumEl = unit.querySelector<HTMLElement>("ul.content li:first-child .ch-num");
      const chapterText = chNumEl?.textContent?.trim();
      if (!chapterText) return;

      const chapter = extractChapterNumber(chapterText);
      if (chapter === null) return;

      entries.push({
        element: unit,
        title: cleanTitle(stripScanlationSuffix(title)),
        latestChapter: Math.floor(chapter),
        url: titleLink.href,
      });
    });

    return entries;
  }
}