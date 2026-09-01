import { t } from "../../utils/i18n";
import { flushPendingUpdates } from "../messaging";

export async function renderPendingQueue(): Promise<void> {
  const { pendingUpdates } = await chrome.storage.local.get({ pendingUpdates: [] });
  const banner = document.getElementById("pending-queue")!;
  const label = document.getElementById("pending-queue-label")!;
  const btn = document.getElementById("btn-retry-now") as HTMLButtonElement;

  if (pendingUpdates.length === 0) {
    banner.style.display = "none";
    return;
  }

  banner.style.display = "flex";
  label.textContent = t("pendingQueueLabel", String(pendingUpdates.length));
  btn.textContent = t("retryNow");
  btn.disabled = false;

  btn.onclick = async () => {
    btn.disabled = true;
    btn.textContent = t("stateLoading");
    await flushPendingUpdates();
    await renderPendingQueue();
  };
}

export async function renderPendingErrors(): Promise<void> {
  const session = await chrome.storage.session.get("pendingUpdateErrorCount");
  const count = session.pendingUpdateErrorCount as number | undefined;
  if (!count) return;

  const banner = document.getElementById("pending-errors")!;
  const label = document.getElementById("pending-errors-label")!;
  banner.style.display = "flex";
  label.textContent = t("pendingUpdateErrors", String(count));

  await chrome.storage.session.remove("pendingUpdateErrorCount");
}
