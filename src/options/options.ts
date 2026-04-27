import { getStorage, setStorage, getTheme, setTheme } from "../utils/storage";
import { t } from "../utils/i18n";

async function init() {
  const storage = await getStorage();
  const theme = await getTheme();

  applyTheme(theme);
  updateThemeButtons(theme);

  const nameEl = document.getElementById("account-name")!;
  const idEl = document.getElementById("account-id")!;

  if (storage.userId) {
    nameEl.textContent = t("accountName");
    idEl.textContent = t("accountId", String(storage.userId));
  } else {
    nameEl.textContent = t("notConnected");
  }

  const toggle = document.getElementById("toggle-autoupdate") as HTMLInputElement;
  toggle.checked = storage.autoUpdate;
  toggle.addEventListener("change", async () => {
    await setStorage({ autoUpdate: toggle.checked });
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

init();