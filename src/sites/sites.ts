import { getTheme } from "../utils/storage";
import { t } from "../utils/i18n";
import type { MediaType } from "../types";
import { getSupportedSites, type SupportedSiteEntry } from "./registry";

type KindFilter = "ALL" | MediaType;

const sites = getSupportedSites();
let kindFilter: KindFilter = "ALL";
let query = "";

function kindLabel(kind: MediaType): string {
  return kind === "MANGA" ? t("typeManga") : t("typeAnime");
}

function matches(site: SupportedSiteEntry): boolean {
  if (kindFilter !== "ALL" && !site.kinds.includes(kindFilter)) return false;
  if (!query) return true;
  const haystack = [site.displayName, ...site.hostnames].join(" ").toLowerCase();
  return haystack.includes(query);
}

function buildCard(site: SupportedSiteEntry): HTMLElement {
  const card = document.createElement("div");
  card.className = "card";

  const name = document.createElement("div");
  name.className = "card-name";
  name.textContent = site.displayName;
  card.appendChild(name);

  const hosts = document.createElement("div");
  hosts.className = "card-hosts";
  for (const hostname of site.hostnames) {
    const link = document.createElement("a");
    link.href = `https://${hostname}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = hostname;
    hosts.appendChild(link);
  }
  card.appendChild(hosts);

  const kinds = document.createElement("div");
  kinds.className = "kinds";
  for (const kind of site.kinds) {
    const chip = document.createElement("span");
    chip.className = "kind";
    chip.textContent = kindLabel(kind);
    kinds.appendChild(chip);
  }
  card.appendChild(kinds);

  return card;
}

function renderGrid(): void {
  const grid = document.getElementById("grid")!;
  grid.innerHTML = "";

  const visible = sites.filter(matches);
  if (visible.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = t("noSitesFound");
    grid.appendChild(empty);
    return;
  }

  for (const site of visible) grid.appendChild(buildCard(site));
}

function countFor(kind: KindFilter): number {
  return kind === "ALL" ? sites.length : sites.filter((s) => s.kinds.includes(kind)).length;
}

function renderFilters(): void {
  document.querySelectorAll<HTMLButtonElement>(".filter").forEach((button) => {
    const kind = button.dataset.kind as KindFilter;
    const label = kind === "ALL" ? t("filterAll") : kindLabel(kind);
    button.textContent = `${label} · ${countFor(kind)}`;
    button.setAttribute("aria-pressed", String(kind === kindFilter));
  });
}

async function init(): Promise<void> {
  document.documentElement.setAttribute("data-theme", await getTheme());

  const title = t("sectionSupportedSites");
  document.title = `${title} — AniList Tracker`;
  document.getElementById("page-title")!.textContent = title;
  document.getElementById("hint")!.textContent = t("supportedSitesHint");

  const search = document.getElementById("search") as HTMLInputElement;
  search.placeholder = t("searchSites");
  search.addEventListener("input", () => {
    query = search.value.trim().toLowerCase();
    renderGrid();
  });

  document.querySelectorAll<HTMLButtonElement>(".filter").forEach((button) => {
    button.addEventListener("click", () => {
      kindFilter = button.dataset.kind as KindFilter;
      renderFilters();
      renderGrid();
    });
  });

  renderFilters();
  renderGrid();
}

init();
