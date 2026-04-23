import { getStorage } from "../utils/storage";
import type { AniListMedia, MangaDetection } from "../types";

const loginView = document.getElementById("login-view")!;
const mainView = document.getElementById("main-view")!;
const btnLogin = document.getElementById("btn-login")!;
const usernameEl = document.getElementById("username")!;
const detectionSection = document.getElementById("detection-section")!;
const emptySection = document.getElementById("empty-section")!;
const detectedTitle = document.getElementById("detected-title")!;
const detectedChapter = document.getElementById("detected-chapter")!;
const detectedSource = document.getElementById("detected-source")!;
const resultsSection = document.getElementById("results-section")!;
const resultsList = document.getElementById("results-list")!;
const confirmSection = document.getElementById("confirm-section")!;
const btnUpdate = document.getElementById("btn-update")!;

let currentDetection: MangaDetection | null = null;
let selectedMediaId: number | null = null;

async function init() {
  const storage = await getStorage();

  if (!storage.accessToken) {
    loginView.style.display = "block";
    mainView.style.display = "none";
  } else {
    loginView.style.display = "none";
    mainView.style.display = "block";
    usernameEl.textContent = `User #${storage.userId}`;
    await loadDetection();
  }
}

btnLogin.addEventListener("click", async () => {
  btnLogin.textContent = "Connecting...";
  const response = await chrome.runtime.sendMessage({ type: "GET_AUTH_TOKEN" });

  if (response?.success) {
    usernameEl.textContent = response.username;
    loginView.style.display = "none";
    mainView.style.display = "block";
    await loadDetection();
  } else {
    btnLogin.textContent = "Connect to AniList";
    alert("Connection failed. Please try again.");
  }
});

async function loadDetection() {
  const session = await chrome.storage.session.get([
    "lastDetection",
    "searchResults",
    "confirmedMediaId",
    "currentProgress",
  ]);

  if (!session.lastDetection) {
    detectionSection.style.display = "none";
    emptySection.style.display = "block";
    return;
  }

  currentDetection = session.lastDetection as MangaDetection;
  detectionSection.style.display = "block";
  emptySection.style.display = "none";

  detectedTitle.textContent = currentDetection.title;
  detectedChapter.textContent = `Chapter ${currentDetection.chapter}`;
  detectedSource.textContent = `Source: ${currentDetection.source} · ${new URL(currentDetection.url).hostname}`;

  const currentProgress = session.currentProgress as number | null;
  if (currentProgress !== null) {
    detectedChapter.textContent = `Chapter ${currentDetection.chapter} (currently at ${currentProgress})`;
  }
  
  if (session.confirmedMediaId) {
    selectedMediaId = session.confirmedMediaId;
    resultsSection.style.display = "none";
    confirmSection.style.display = "block";
    await updateButtonState();
  } else if (session.searchResults) {
    showResults(session.searchResults as AniListMedia[]);
  }
}

function showResults(results: AniListMedia[]) {
  resultsList.innerHTML = "";
  resultsSection.style.display = "block";
  confirmSection.style.display = "none";

  for (const media of results) {
    const li = document.createElement("li");
    li.innerHTML = `
      <img src="${media.coverImage.medium}" alt="" />
      <div class="info">
        <div class="title">${media.title.english ?? media.title.romaji}</div>
        <div class="subtitle">${media.title.romaji}</div>
      </div>
    `;
    li.addEventListener("click", () => selectMedia(media));
    resultsList.appendChild(li);
  }
}

async function updateButtonState() {
  if (!currentDetection) return;

  const session = await chrome.storage.session.get("currentProgress");
  const currentProgress = session.currentProgress as number | null;

  if (currentProgress !== null && currentDetection.chapter <= currentProgress) {
    btnUpdate.textContent = `Already at Ch. ${currentProgress} — no update needed`;
    btnUpdate.classList.remove("btn-success");
    btnUpdate.classList.add("btn-ghost");
    btnUpdate.setAttribute("disabled", "true");
  } else if (currentProgress !== null) {
    btnUpdate.textContent = `Update ${currentProgress} → ${currentDetection.chapter}`;
    btnUpdate.classList.add("btn-success");
    btnUpdate.classList.remove("btn-ghost");
    btnUpdate.removeAttribute("disabled");
  } else {
    btnUpdate.textContent = `Update to Chapter ${currentDetection.chapter}`;
    btnUpdate.classList.add("btn-success");
    btnUpdate.classList.remove("btn-ghost");
    btnUpdate.removeAttribute("disabled");
  }
}

async function selectMedia(media: AniListMedia) {
  selectedMediaId = media.id;

  if (currentDetection) {
    const { saveTitleMapping } = await import("../utils/storage");
    await saveTitleMapping(currentDetection.title, media.id);
  }

  const response = await chrome.runtime.sendMessage({
    type: "GET_PROGRESS",
    payload: { mediaId: media.id },
  });

  if (response?.progress !== undefined) {
    await chrome.storage.session.set({ currentProgress: response.progress });
  }

  resultsSection.style.display = "none";
  confirmSection.style.display = "block";
  await updateButtonState();
}

btnUpdate.addEventListener("click", async () => {
  if (!selectedMediaId || !currentDetection) return;

  btnUpdate.textContent = "Updating...";
  btnUpdate.setAttribute("disabled", "true");

  const response = await chrome.runtime.sendMessage({
    type: "UPDATE_PROGRESS",
    payload: {
      mediaId: selectedMediaId,
      chapter: currentDetection.chapter,
    },
  });

  if (response?.success) {
    if (response.skipped) {
      btnUpdate.textContent = `Already at Ch. ${response.current} ✓`;
    } else {
      btnUpdate.textContent = `Updated to Ch. ${response.progress} ✓`;
    }
    btnUpdate.classList.remove("btn-success");
    btnUpdate.classList.add("btn-ghost");

    chrome.action.setBadgeText({ text: "" });
  } else {
    btnUpdate.textContent = "Error — Retry?";
    btnUpdate.removeAttribute("disabled");
  }
});

init();
