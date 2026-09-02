import { t } from "../../utils/i18n";
import type { AniListMedia, MediaDetection } from "../../types";
import { searchAniList } from "../messaging";
import { updateTabState } from "../state";

export interface ResultsOptions {
  onSelect: (media: AniListMedia) => void;
}

export function showResults(
  results: AniListMedia[],
  detection: MediaDetection,
  options: ResultsOptions
): void {
  const section = document.getElementById("results-section")!;
  const list = document.getElementById("results-list")!;
  section.style.display = "block";
  list.innerHTML = "";

  for (const media of results) {
    list.appendChild(buildResultRow(media, options));
  }

  const li = document.createElement("li");
  li.style.cssText = "display:block;padding:6px 0 2px";

  const retryBtn = document.createElement("button");
  retryBtn.className = "btn btn-ghost";
  retryBtn.style.cssText = "width:100%;font-size:12px;padding:6px";
  retryBtn.textContent = t("searchOtherTitle");
  retryBtn.addEventListener("click", () => showManualSearch(detection, options));

  li.appendChild(retryBtn);
  list.appendChild(li);
}

function buildResultRow(media: AniListMedia, options: ResultsOptions): HTMLLIElement {
  const li = document.createElement("li");

  const img = document.createElement("img");
  img.alt = "";
  try {
    const imgUrl = new URL(media.coverImage.medium);
    if (imgUrl.protocol === "https:") img.src = imgUrl.href;
  } catch {
    img.style.visibility = "hidden";
  }

  const info = document.createElement("div");
  info.className = "info";

  const titleDiv = document.createElement("div");
  titleDiv.className = "title";
  titleDiv.textContent = media.title.english ?? media.title.romaji;

  const subtitleDiv = document.createElement("div");
  subtitleDiv.className = "subtitle";
  subtitleDiv.textContent = media.title.romaji;

  info.appendChild(titleDiv);
  info.appendChild(subtitleDiv);
  li.appendChild(img);
  li.appendChild(info);
  li.addEventListener("click", () => options.onSelect(media));

  return li;
}

export function showManualSearch(
  detection: MediaDetection,
  options: ResultsOptions,
  message?: string
): void {
  const section = document.getElementById("results-section")!;
  const label = document.getElementById("results-label")!;
  const list = document.getElementById("results-list")!;

  label.textContent = t("noResultsFound");
  section.style.display = "block";
  list.innerHTML = "";

  const li = document.createElement("li");
  li.style.cssText = "padding:4px 0 10px;display:block";

  const hint = document.createElement("p");
  hint.className = "state-hint";
  hint.style.marginBottom = "8px";
  hint.textContent = message ?? t("noResultsHint");

  const row = document.createElement("div");
  row.style.cssText = "display:flex;gap:6px";

  const input = document.createElement("input");
  input.id = "manual-search-input";
  input.type = "text";
  input.value = detection.title;
  input.style.cssText = "flex:1;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:6px;padding:7px 10px;font-size:13px;color:var(--text-primary);outline:none";

  const btn = document.createElement("button");
  btn.id = "btn-manual-search";
  btn.className = "btn btn-primary";
  btn.style.cssText = "width:auto;padding:7px 12px;flex-shrink:0";
  btn.textContent = "🔍";

  row.appendChild(input);
  row.appendChild(btn);
  li.appendChild(hint);
  li.appendChild(row);
  list.appendChild(li);

  const doSearch = async () => {
    const query = input.value.trim();
    if (!query) return;

    btn.textContent = "…";
    btn.disabled = true;

    const response = await searchAniList(query, detection.mediaType);

    btn.textContent = "🔍";
    btn.disabled = false;

    if (response?.results && response.results.length > 0) {
      await updateTabState({ searchResults: response.results });
      showResults(response.results, detection, options);
      document.getElementById("results-label")!.textContent =
        detection.mediaType === "ANIME" ? t("selectAnime") : t("selectManga");
      return;
    }

    showManualSearch(detection, options, t("noResultsRetry"));
  };

  btn.addEventListener("click", doSearch);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch();
  });
}
