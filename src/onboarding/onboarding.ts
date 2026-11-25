import { getTheme } from "../utils/storage";
import { t } from "../utils/i18n";
import type { SupportedSite } from "../types";
import { getSupportedSites, type SupportedSiteEntry } from "../sites/registry";
import { readEnabledSites } from "../sites/enabled";
import { applySelection } from "../sites/apply";

type GroupKey = "manga" | "anime" | "both";

const sites = getSupportedSites();
const selected = new Set<SupportedSite>();

function groupOf(site: SupportedSiteEntry): GroupKey {
  if (site.kinds.length > 1) return "both";
  return site.kinds[0] === "ANIME" ? "anime" : "manga";
}

function groupLabel(group: GroupKey): string {
  if (group === "manga") return t("onboardingGroupManga");
  if (group === "anime") return t("onboardingGroupAnime");
  return t("onboardingGroupBoth");
}

function byId<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function updatePermissionNote(): void {
  const needsPrompt = sites.some((site) => site.access === "optional" && selected.has(site.id));
  const note = byId<HTMLParagraphElement>("permission-note");
  note.hidden = !needsPrompt;
  note.textContent = needsPrompt ? t("onboardingPermissionNote") : "";
}

function buildRow(site: SupportedSiteEntry): HTMLElement {
  const row = document.createElement("label");
  row.className = "row";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.dataset.site = site.id;
  input.checked = selected.has(site.id);
  input.addEventListener("change", () => {
    if (input.checked) selected.add(site.id);
    else selected.delete(site.id);
    updatePermissionNote();
  });

  const main = document.createElement("div");
  main.className = "row-main";
  const name = document.createElement("div");
  name.className = "row-name";
  name.textContent = site.displayName;
  const hosts = document.createElement("div");
  hosts.className = "row-hosts";
  hosts.textContent = site.hostnames.join(", ");
  main.append(name, hosts);

  row.append(input, main);

  if (site.official) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = t("badgeOfficial");
    row.appendChild(chip);
  }

  return row;
}

function setGroup(group: GroupKey, checked: boolean): void {
  for (const site of sites) {
    if (groupOf(site) !== group) continue;
    if (checked) selected.add(site.id);
    else selected.delete(site.id);
  }
  document.querySelectorAll<HTMLInputElement>("input[data-site]").forEach((input) => {
    const site = sites.find((entry) => entry.id === input.dataset.site);
    if (site && groupOf(site) === group) input.checked = checked;
  });
  updatePermissionNote();
}

function renderGroups(): void {
  const container = byId<HTMLDivElement>("groups");
  container.innerHTML = "";

  for (const group of ["manga", "anime", "both"] as GroupKey[]) {
    const members = sites.filter((site) => groupOf(site) === group);
    if (members.length === 0) continue;

    const section = document.createElement("section");
    section.className = "group";

    const head = document.createElement("div");
    head.className = "group-head";
    const title = document.createElement("h2");
    title.className = "group-title";
    title.textContent = groupLabel(group);

    const actions = document.createElement("div");
    actions.className = "group-actions";
    const all = document.createElement("button");
    all.type = "button";
    all.className = "link-btn";
    all.textContent = t("onboardingSelectAll");
    all.addEventListener("click", () => setGroup(group, true));
    const none = document.createElement("button");
    none.type = "button";
    none.className = "link-btn";
    none.textContent = t("onboardingSelectNone");
    none.addEventListener("click", () => setGroup(group, false));
    actions.append(all, none);
    head.append(title, actions);

    const list = document.createElement("div");
    list.className = "list";
    for (const site of members) list.appendChild(buildRow(site));

    section.append(head, list);
    container.appendChild(section);
  }
}

async function save(): Promise<void> {
  const button = byId<HTMLButtonElement>("save");
  const error = byId<HTMLParagraphElement>("error");
  button.disabled = true;
  button.textContent = t("onboardingSaving");
  error.hidden = true;

  try {
    const result = await applySelection(Array.from(selected));
    await chrome.storage.local.set({ onboardingDone: true });

    if (result.denied.length > 0) {
      const names = result.denied
        .map((id) => sites.find((site) => site.id === id)?.displayName ?? id)
        .join(", ");
      error.textContent = t("onboardingDenied", names);
      error.hidden = false;
      for (const id of result.denied) selected.delete(id);
      renderGroups();
      updatePermissionNote();
      button.disabled = false;
      button.textContent = t("onboardingSave");
      return;
    }

    byId("picker").hidden = true;
    byId("done").hidden = false;
  } catch {
    error.textContent = t("onboardingError");
    error.hidden = false;
    button.disabled = false;
    button.textContent = t("onboardingSave");
  }
}

async function init(): Promise<void> {
  document.documentElement.setAttribute("data-theme", await getTheme());
  document.title = `${t("onboardingTitle")} — AniList Tracker`;

  byId("title").textContent = t("onboardingTitle");
  byId("intro").textContent = t("onboardingIntro");
  byId("done-title").textContent = t("onboardingDoneTitle");
  byId("done-text").textContent = t("onboardingDoneText");
  byId<HTMLButtonElement>("save").textContent = t("onboardingSave");
  byId("save").addEventListener("click", save);

  for (const id of await readEnabledSites()) selected.add(id);
  renderGroups();
  updatePermissionNote();
}

init();
