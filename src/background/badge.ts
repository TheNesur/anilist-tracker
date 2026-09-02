const BADGE_CLEAR_PREFIX = "anilist-tracker:clear-badge:";
const BADGE_CLEAR_DELAY_MIN = 0.05;

type BadgeText = string | null;

function apply(text: BadgeText, tabId?: number): void {
  const details = tabId === undefined ? { text } : { text, tabId };
  Promise.resolve(chrome.action.setBadgeText(details as chrome.action.BadgeTextDetails)).catch(() => {});
}

function applyColor(color: string, tabId?: number): void {
  const details = tabId === undefined ? { color } : { color, tabId };
  Promise.resolve(chrome.action.setBadgeBackgroundColor(details)).catch(() => {});
}

export function setTabBadge(tabId: number, text: string, color: string): void {
  apply(text, tabId);
  applyColor(color, tabId);
}

export function clearTabBadge(tabId: number): void {
  apply(null, tabId);
}

export function scheduleBadgeClear(tabId: number): void {
  chrome.alarms.create(`${BADGE_CLEAR_PREFIX}${tabId}`, { delayInMinutes: BADGE_CLEAR_DELAY_MIN });
}

export function isBadgeClearAlarm(name: string): boolean {
  return name.startsWith(BADGE_CLEAR_PREFIX);
}

export function tabIdFromBadgeAlarm(name: string): number | null {
  const raw = Number(name.slice(BADGE_CLEAR_PREFIX.length));
  return Number.isInteger(raw) ? raw : null;
}

export function updatePendingBadge(count: number): void {
  if (count > 0) {
    apply(String(count));
    applyColor("#f39c12");
  } else {
    apply("");
  }
}
