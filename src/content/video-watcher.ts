import type { MediaDetection } from "../types";
import { injectInlineSyncBanner } from "./reminder-modal";
import { getParser } from "../parsers";

let activeDetection: MediaDetection | null = null;
let bannerTimer: number | null = null;

export function setActiveDetectionForTracking(detection: MediaDetection): void {
  activeDetection = detection;
  if (detection.mediaType === "ANIME") {
    injectInlineSyncBanner(detection);
  }
}

export function initVideoWatcher(): void {
  const tryInject = () => {
    if (!activeDetection) {
      const parser = getParser();
      if (parser && parser.isChapterPage()) {
        const detected = parser.detect();
        if (detected && detected.mediaType === "ANIME") {
          activeDetection = detected;
        }
      }
    }

    if (activeDetection && activeDetection.mediaType === "ANIME") {
      injectInlineSyncBanner(activeDetection);
    }
  };

  tryInject();
  if (bannerTimer !== null) clearInterval(bannerTimer);
  bannerTimer = window.setInterval(tryInject, 1000);
}
