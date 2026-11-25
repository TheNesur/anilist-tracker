import { getTheme } from "../utils/storage";
import { t } from "../utils/i18n";
import type { MediaType } from "../types";
import { getSupportedSites, type SupportedSiteEntry } from "./registry";
import { hasSiteAccess } from "./access";
import { readEnabledSites } from "./enabled";
import { setSiteEnabled } from "./apply";

type KindFilter = "ALL" | MediaType;

const sites = getSupportedSites();
let kindFilter: KindFilter = "ALL";
let query = "";
let enabledIds = new Set<string>();
let accessIds = new Set<string>();
let busyId: string | null = null;

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

  const head = document.createElement("div");
  head.className = "card-head";

  const name = document.createElement("div");
  name.className = "card-name";
  name.textContent = site.displayName;
  head.appendChild(name);

  const toggle = document.createElement("label");
  toggle.className = "switch";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = enabledIds.has(site.id);
  input.disabled = busyId !== null;
  input.setAttribute("aria-label", site.displayName);
  input.addEventListener("change", () => handleToggle(site, input.checked));
  const slider = document.createElement("span");
  slider.className = "slider";
  toggle.append(input, slider);
  head.appendChild(toggle);
  card.appendChild(head);

  const status = document.createElement("div");
  const isEnabled = enabledIds.has(site.id);
  const needsPermission = isEnabled && !accessIds.has(site.id);
  status.className = `status ${needsPermission ? "status-warn" : isEnabled ? "status-on" : "status-off"}`;
  status.textContent = needsPermission
    ? t("siteStatusPermissionMissing")
    : isEnabled
      ? t("siteStatusActive")
      : t("siteStatusDisabled");
  card.appendChild(status);

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
  if (site.official) {
    const chip = document.createElement("span");
    chip.className = "kind kind-official";
    chip.textContent = t("badgeOfficial");
    kinds.appendChild(chip);
  }
  card.appendChild(kinds);

  return card;
}

async function refreshState(): Promise<void> {
  enabledIds = new Set(await readEnabledSites());
  const access = new Set<string>();
  for (const site of sites) {
    if (await hasSiteAccess(site.id)) access.add(site.id);
  }
  accessIds = access;
}

async function handleToggle(site: SupportedSiteEntry, enabled: boolean): Promise<void> {
  if (busyId !== null) return;
  busyId = site.id;
  try {
    await setSiteEnabled(site.id, enabled);
  } finally {
    busyId = null;
    await refreshState();
    renderGrid();
  }
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

  await refreshState();
  renderFilters();
  renderGrid();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.enabledSites || busyId !== null) return;
    refreshState().then(renderGrid);
  });
  chrome.permissions.onAdded.addListener(() => refreshState().then(renderGrid));
  chrome.permissions.onRemoved.addListener(() => refreshState().then(renderGrid));
}

init();
