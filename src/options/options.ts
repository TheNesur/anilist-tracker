import { getStorage, setStorage, getTheme, setTheme, removeTitleMapping } from "../utils/storage";
import { t } from "../utils/i18n";

async function init() {
  const storage = await getStorage();
  const theme = await getTheme();

  applyTheme(theme);
  updateThemeButtons(theme);

  const nameEl = document.getElementById("account-name")!;
  const idEl = document.getElementById("account-id")!;

  if (storage.userId) {
    nameEl.textContent = storage.username ?? t("accountName");
    idEl.textContent = t("accountId", String(storage.userId));
  } else {
    nameEl.textContent = t("notConnected");
  }

  const autoUpdateToggle = document.getElementById("toggle-autoupdate") as HTMLInputElement;
  autoUpdateToggle.checked = storage.autoUpdate;
  autoUpdateToggle.addEventListener("change", async () => {
    await setStorage({ autoUpdate: autoUpdateToggle.checked });
  });

  const autoMapToggle = document.getElementById("toggle-automap") as HTMLInputElement;
  autoMapToggle.checked = storage.autoMap;
  autoMapToggle.addEventListener("change", async () => {
    await setStorage({ autoMap: autoMapToggle.checked });
  });

  const contributeAliasesToggle = document.getElementById("toggle-contribute-aliases") as HTMLInputElement;
  contributeAliasesToggle.checked = storage.contributeAliases;
  contributeAliasesToggle.addEventListener("change", async () => {
    await setStorage({ contributeAliases: contributeAliasesToggle.checked });
  });

  document.getElementById("theme-dark")!.addEventListener("click", () => switchTheme("dark"));
  document.getElementById("theme-light")!.addEventListener("click", () => switchTheme("light"));

  document.getElementById("page-title")!.textContent = t("settingsTitle");
  document.getElementById("section-account")!.textContent = t("sectionAccount");
  document.getElementById("section-appearance")!.textContent = t("sectionAppearance");
  document.getElementById("section-behavior")!.textContent = t("sectionBehavior");
  document.getElementById("section-info")!.textContent = t("sectionInfo");
  document.getElementById("section-danger")!.textContent = t("dangerZone");
  document.getElementById("label-autoupdate")!.textContent = t("autoUpdate");
  document.getElementById("hint-autoupdate")!.textContent = t("autoUpdateHint");
  document.getElementById("label-automap")!.textContent = t("autoMap");
  document.getElementById("hint-automap")!.textContent = t("autoMapHint");
  document.getElementById("label-contribute-aliases")!.textContent = t("contributeAliases");
  document.getElementById("hint-contribute-aliases")!.textContent = t("contributeAliasesHint");
  document.getElementById("label-logout")!.textContent = t("logout");
  document.getElementById("hint-logout")!.textContent = t("logoutHint");
  document.getElementById("btn-logout")!.textContent = t("logout");
  document.getElementById("link-source")!.textContent = t("linkSourceCode");
  document.getElementById("link-bug")!.textContent = t("linkReportBug");
  document.getElementById("link-privacy")!.textContent = t("linkPrivacy");
  document.getElementById("link-anilist")!.textContent = t("linkAniList");
  document.getElementById("theme-dark-label")!.textContent = t("themeDark");
  document.getElementById("theme-light-label")!.textContent = t("themeLight");

  document.getElementById("btn-logout")!.addEventListener("click", async () => {
    if (!confirm(t("logoutConfirm"))) return;
    await chrome.storage.local.clear();
    await chrome.storage.session.clear();
    window.close();
  });

  document.getElementById("section-mappings")!.textContent = t("sectionMappings");
  await renderMappings();

  const mappingsSearch = document.getElementById("mappings-search") as HTMLInputElement;
  mappingsSearch.placeholder = t("searchMappings");
  mappingsSearch.addEventListener("input", () => {
    renderMappings(mappingsSearch.value);
  });

  const manifest = chrome.runtime.getManifest();
  document.getElementById("version")!.textContent = `v${manifest.version}`;
}

function applyTheme(theme: "dark" | "light") {
  document.documentElement.setAttribute("data-theme", theme);
}

function updateThemeButtons(theme: "dark" | "light") {
  document.getElementById("theme-dark")!.classList.toggle("active", theme === "dark");
  document.getElementById("theme-light")!.classList.toggle("active", theme === "light");
}

async function switchTheme(theme: "dark" | "light") {
  await setTheme(theme);
  applyTheme(theme);
  updateThemeButtons(theme);
  chrome.runtime.sendMessage({ type: "THEME_CHANGED", payload: { theme } }).catch(() => {});
}

async function renderMappings(filter = "") {
  const storage = await getStorage();
  const mappings = storage.titleMappings;
  const container = document.getElementById("mappings-list")!;
  container.innerHTML = "";

  const entries = Object.entries(mappings).filter(([title]) =>
    title.toLowerCase().includes(filter.toLowerCase())
  );

  if (Object.keys(mappings).length === 0) {
    container.innerHTML = `<p class="empty-hint">${t("noMappings")}</p>`;
    return;
  }

  if (entries.length === 0) {
    container.innerHTML = `<p class="empty-hint">${t("noMappingsSearch")}</p>`;
    return;
  }

  for (const [siteTitle, mediaId] of entries) {
    const row = document.createElement("div");
    row.className = "mapping-row";
    row.innerHTML = `
      <div class="mapping-info">
        <div class="mapping-title">${siteTitle}</div>
        <div class="mapping-id">AniList ID : ${mediaId}</div>
      </div>
      <button class="btn-remove" data-title="${siteTitle}">✕</button>
    `;
    row.querySelector(".btn-remove")!.addEventListener("click", async () => {
      await removeTitleMapping(siteTitle);
      await renderMappings(filter);
    });
    container.appendChild(row);
  }
}

init();