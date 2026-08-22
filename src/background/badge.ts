const BADGE_CLEAR_ALARM = "anilist-tracker:clear-badge";
const BADGE_CLEAR_DELAY_MIN = 0.05;

export function scheduleBadgeClear() {
  chrome.alarms.create(BADGE_CLEAR_ALARM, { delayInMinutes: BADGE_CLEAR_DELAY_MIN });
}

export function updatePendingBadge(count: number) {
  if (count > 0) {
    chrome.action.setBadgeText({ text: String(count) });
    chrome.action.setBadgeBackgroundColor({ color: "#f39c12" });
  } else {
    chrome.action.setBadgeText({ text: "" });
  }
}

export function isBadgeClearAlarm(name: string): boolean {
  return name === BADGE_CLEAR_ALARM;
}
