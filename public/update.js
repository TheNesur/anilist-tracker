(async () => {
  const { theme } = await chrome.storage.local.get({ theme: "dark" });
  document.documentElement.setAttribute("data-theme", theme);

  const version = chrome.runtime.getManifest().version;
  const isFrench = chrome.i18n.getUILanguage().startsWith("fr");

  document.getElementById("version-badge").textContent = `v${version}`;
  document.getElementById("title").textContent = isFrench
    ? "AniList Tracker a été mis à jour"
    : "AniList Tracker has been updated";

  let changelog = {};
  try {
    const res = await fetch(chrome.runtime.getURL("changelog.json"));
    changelog = await res.json();
  } catch {
    changelog = {};
  }

  const entry = changelog[version] ?? null;
  const list = document.getElementById("changes");

  if (entry) {
    const changes = isFrench ? entry.fr : entry.en;
    document.getElementById("subtitle").textContent = isFrench
      ? "Voici ce qui a changé dans cette version :"
      : "Here's what changed in this version:";
    for (const change of changes) {
      const li = document.createElement("li");
      li.textContent = change;
      list.appendChild(li);
    }
  } else {
    document.getElementById("subtitle").textContent = isFrench
      ? "Une nouvelle version est installée. Le détail des changements est disponible sur GitHub."
      : "A new version has been installed. Full changelog available on GitHub.";
  }

  function compareVersions(a, b) {
    const pa = a.split(".").map(Number);
    const pb = b.split(".").map(Number);
    for (let i = 0; i < 3; i++) {
      if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pb[i] ?? 0) - (pa[i] ?? 0);
    }
    return 0;
  }

  const olderVersions = Object.keys(changelog)
    .filter((v) => v !== version)
    .sort(compareVersions);

  const toggleBtn = document.getElementById("toggle-history");
  const historyDiv = document.getElementById("history");

  if (olderVersions.length === 0) {
    toggleBtn.style.display = "none";
  } else {
    toggleBtn.textContent = isFrench ? "Voir les mises à jour précédentes" : "See previous updates";
    let expanded = false;

    toggleBtn.addEventListener("click", () => {
      expanded = !expanded;
      historyDiv.style.display = expanded ? "block" : "none";
      toggleBtn.textContent = expanded
        ? (isFrench ? "Masquer les mises à jour précédentes" : "Hide previous updates")
        : (isFrench ? "Voir les mises à jour précédentes" : "See previous updates");
    });

    for (const v of olderVersions) {
      const block = document.createElement("div");
      block.className = "version-block";

      const title = document.createElement("div");
      title.className = "version-title";
      title.textContent = changelog[v].label ?? `v${v}`;
      block.appendChild(title);

      const ul = document.createElement("ul");
      const changes = isFrench ? changelog[v].fr : changelog[v].en;
      for (const change of changes) {
        const li = document.createElement("li");
        li.textContent = change;
        ul.appendChild(li);
      }
      block.appendChild(ul);
      historyDiv.appendChild(block);
    }
  }
})();