import { getStorage, setStorage, getTheme, setTheme, removeTitleMapping, logoutSelective } from "../utils/storage";
import { escapeHtml } from "../utils/dom";
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

  const betaSection = document.getElementById("beta-section")!;
  const betaToggle = document.getElementById("toggle-beta-features") as HTMLInputElement;
  betaToggle.checked = storage.showBetaFeatures;
  betaSection.style.display = storage.showBetaFeatures ? "block" : "none";
  betaToggle.addEventListener("change", async () => {
    await setStorage({ showBetaFeatures: betaToggle.checked });
    betaSection.style.display = betaToggle.checked ? "block" : "none";
  });

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

  const catalogStatusToggle = document.getElementById("toggle-catalog-status") as HTMLInputElement;
  catalogStatusToggle.checked = storage.showCatalogStatus;
  catalogStatusToggle.addEventListener("change", async () => {
    await setStorage({ showCatalogStatus: catalogStatusToggle.checked });
  });

  const showUpdatePageToggle = document.getElementById("toggle-show-update-page") as HTMLInputElement;
  showUpdatePageToggle.checked = storage.showUpdatePage;
  showUpdatePageToggle.addEventListener("change", async () => {
    await setStorage({ showUpdatePage: showUpdatePageToggle.checked });
  });

  document.getElementById("theme-dark")!.addEventListener("click", () => switchTheme("dark"));
  document.getElementById("theme-light")!.addEventListener("click", () => switchTheme("light"));

  document.getElementById("page-title")!.textContent = t("settingsTitle");
  document.getElementById("section-account")!.textContent = t("sectionAccount");
  document.getElementById("section-appearance")!.textContent = t("sectionAppearance");
  document.getElementById("section-behavior")!.textContent = t("sectionBehavior");
  document.getElementById("section-info")!.textContent = t("sectionInfo");
  document.getElementById("section-danger")!.textContent = t("dangerZone");
  document.getElementById("label-beta-features")!.textContent = t("betaFeatures");
  document.getElementById("hint-beta-features")!.textContent = t("betaFeaturesHint");
  document.getElementById("section-beta")!.textContent = t("sectionBeta");
  document.getElementById("label-autoupdate")!.textContent = t("autoUpdate");
  document.getElementById("hint-autoupdate")!.textContent = t("autoUpdateHint");
  document.getElementById("label-automap")!.textContent = t("autoMap");
  document.getElementById("hint-automap")!.textContent = t("autoMapHint");
  document.getElementById("label-contribute-aliases")!.textContent = t("contributeAliases");
  document.getElementById("hint-contribute-aliases")!.textContent = t("contributeAliasesHint");
  document.getElementById("label-catalog-status")!.textContent = t("catalogStatus");
  document.getElementById("hint-catalog-status")!.textContent = t("catalogStatusHint");
  document.getElementById("label-show-update-page")!.textContent = t("showUpdatePage");
  document.getElementById("hint-show-update-page")!.textContent = t("showUpdatePageHint");
  document.getElementById("label-logout")!.textContent = t("logout");
  document.getElementById("hint-logout")!.textContent = t("logoutHint");
  document.getElementById("btn-logout")!.textContent = t("logout");
  document.getElementById("link-discord")!.textContent = t("linkDiscord");
  document.getElementById("link-source")!.textContent = t("linkSourceCode");
  document.getElementById("link-bug")!.textContent = t("linkReportBug");
  document.getElementById("link-privacy")!.textContent = t("linkPrivacy");
  document.getElementById("link-anilist")!.textContent = t("linkAniList");
  document.getElementById("theme-dark-label")!.textContent = t("themeDark");
  document.getElementById("theme-light-label")!.textContent = t("themeLight");

  document.getElementById("btn-logout")!.addEventListener("click", async () => {
    if (!confirm(t("logoutConfirm"))) return;
    await logoutSelective();
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
}

async function renderMappings(filter = "") {
  const storage = await getStorage();
  const mappings = storage.titleMappings;
  const container = document.getElementById("mappings-list")!;
  container.innerHTML = "";

  const entries = Object.entries(mappings).filter(([key]) => {
    const title = key.lastIndexOf("::") > 0 ? key.slice(0, key.lastIndexOf("::")) : key;
    return title.toLowerCase().includes(filter.toLowerCase());
  });

  if (Object.keys(mappings).length === 0) {
    const hint = document.createElement("p");
    hint.className = "empty-hint";
    hint.textContent = t("noMappings");
    container.appendChild(hint);
    return;
  }

  if (entries.length === 0) {
    const hint = document.createElement("p");
    hint.className = "empty-hint";
    hint.textContent = t("noMappingsSearch");
    container.appendChild(hint);
    return;
  }

  for (const [mappingKey, mediaId] of entries) {
    const separatorIndex = mappingKey.lastIndexOf("::");
    const displayTitle = separatorIndex > 0 ? mappingKey.slice(0, separatorIndex) : mappingKey;
    const mediaType = separatorIndex > 0 ? mappingKey.slice(separatorIndex + 2) : null;

    const row = document.createElement("div");
    row.className = "mapping-row";

    const info = document.createElement("div");
    info.className = "mapping-info";

    const titleDiv = document.createElement("div");
    titleDiv.className = "mapping-title";
    titleDiv.textContent = displayTitle;

    const idDiv = document.createElement("div");
    idDiv.className = "mapping-id";
    idDiv.textContent = mediaType
      ? `AniList ID : ${mediaId} · ${mediaType}`
      : `AniList ID : ${mediaId}`;

    info.appendChild(titleDiv);
    info.appendChild(idDiv);

    const removeBtn = document.createElement("button");
    removeBtn.className = "btn-remove";
    removeBtn.textContent = "✕";
    removeBtn.addEventListener("click", async () => {
      await removeTitleMapping(mappingKey);
      await renderMappings(filter);
    });

    row.appendChild(info);
    row.appendChild(removeBtn);
    container.appendChild(row);
  }
}

init();
