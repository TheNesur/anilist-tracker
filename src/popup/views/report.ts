import { t } from "../../utils/i18n";
import type { AniListMedia, MediaDetection, ReportContextName, ReportKind } from "../../types";
import { reportAlias, reportFeedback } from "../messaging";

const NOTE_MAX_LENGTH = 300;
const TITLE_MAX_LENGTH = 300;
const HOSTNAME_MAX_LENGTH = 255;
const HOSTNAME_PATTERN = /^[a-z0-9.-]+$/i;

export interface ReportOption {
  kind: ReportKind;
  labelKey: string;
}

export interface ReportSubject {
  context: ReportContextName;
  hostname: string | null;
  detection: MediaDetection | null;
  media: AniListMedia | null;
}

export const REPORT_OPTIONS = {
  wrongMatch: { kind: "wrong_match", labelKey: "reportKindWrongMatch" },
  wrongDetection: { kind: "site_not_working", labelKey: "reportKindWrongDetection" },
  notFound: { kind: "not_found", labelKey: "reportKindNotFound" },
  siteNotWorking: { kind: "site_not_working", labelKey: "reportKindSiteNotWorking" },
  other: { kind: "other", labelKey: "reportKindOther" },
} satisfies Record<string, ReportOption>;

let formCounter = 0;

export function isReportableHostname(hostname: string): boolean {
  return (
    hostname.length > 0 &&
    hostname.length <= HOSTNAME_MAX_LENGTH &&
    hostname !== "unknown" &&
    HOSTNAME_PATTERN.test(hostname)
  );
}

export function hostnameOf(url: string): string | null {
  try {
    const hostname = new URL(url).hostname;
    return isReportableHostname(hostname) ? hostname : null;
  } catch {
    return null;
  }
}

async function sendReport(kind: ReportKind, note: string | null, subject: ReportSubject): Promise<boolean> {
  const { hostname, detection, media, context } = subject;
  if (!hostname) return false;

  if (detection && media && (kind === "wrong_match" || kind === "other")) {
    const response = await reportAlias({
      alias: detection.title.slice(0, TITLE_MAX_LENGTH),
      mediaType: detection.mediaType,
      mediaId: media.id,
      mediaTitle: (media.title.english ?? media.title.romaji).slice(0, TITLE_MAX_LENGTH),
      sourceHostname: hostname,
      kind,
      note,
    });
    return response?.success === true;
  }

  if (kind === "wrong_match") return false;

  const response = await reportFeedback({
    kind,
    context,
    hostname,
    title: detection ? detection.title.slice(0, TITLE_MAX_LENGTH) : null,
    mediaType: detection?.mediaType ?? null,
    note,
  });
  return response?.success === true;
}

export function buildReportEntry(options: ReportOption[], subject: ReportSubject): HTMLElement | null {
  if (!subject.hostname || options.length === 0) return null;

  const container = document.createElement("div");
  container.className = "report-entry";
  showTrigger(container, options, subject);
  return container;
}

function showTrigger(container: HTMLElement, options: ReportOption[], subject: ReportSubject): void {
  container.innerHTML = "";

  const trigger = document.createElement("button");
  trigger.className = "btn-report";
  trigger.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
      <line x1="4" y1="22" x2="4" y2="15"/>
    </svg>
    <span></span>
  `;
  trigger.querySelector("span")!.textContent = t("reportProblem");
  trigger.addEventListener("click", () => showForm(container, options, subject));
  container.appendChild(trigger);
}

function showForm(container: HTMLElement, options: ReportOption[], subject: ReportSubject): void {
  container.innerHTML = "";

  const form = document.createElement("div");
  form.className = "report-form";

  const groupName = `report-kind-${formCounter++}`;
  const radios: HTMLInputElement[] = [];

  if (options.length > 1) {
    options.forEach((option, index) => {
      const label = document.createElement("label");
      label.className = "report-option";

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = groupName;
      radio.value = String(index);
      radio.checked = index === 0;
      radios.push(radio);

      const text = document.createElement("span");
      text.textContent = t(option.labelKey);

      label.appendChild(radio);
      label.appendChild(text);
      form.appendChild(label);
    });
  } else {
    const title = document.createElement("p");
    title.className = "report-title";
    title.textContent = t(options[0].labelKey);
    form.appendChild(title);
  }

  const note = document.createElement("textarea");
  note.className = "report-note";
  note.maxLength = NOTE_MAX_LENGTH;
  note.placeholder = t("reportNotePlaceholder");
  form.appendChild(note);

  const hint = document.createElement("p");
  hint.className = "report-hint";
  hint.textContent = t("reportNoteHint");
  form.appendChild(hint);

  const error = document.createElement("p");
  error.className = "report-error";
  error.style.display = "none";
  error.textContent = t("reportFailed");
  form.appendChild(error);

  const actions = document.createElement("div");
  actions.className = "report-actions";

  const cancel = document.createElement("button");
  cancel.className = "btn btn-ghost";
  cancel.textContent = t("reportCancel");
  cancel.addEventListener("click", () => showTrigger(container, options, subject));

  const submit = document.createElement("button");
  submit.className = "btn btn-primary";
  submit.textContent = t("reportSubmit");
  submit.addEventListener("click", async () => {
    const selectedIndex = radios.findIndex((radio) => radio.checked);
    const option = options[selectedIndex >= 0 ? selectedIndex : 0];
    const text = note.value.trim().slice(0, NOTE_MAX_LENGTH);

    submit.disabled = true;
    cancel.disabled = true;
    error.style.display = "none";
    submit.textContent = t("stateLoading");

    const ok = await sendReport(option.kind, text.length > 0 ? text : null, subject);

    if (ok) {
      container.innerHTML = "";
      const done = document.createElement("span");
      done.className = "report-done";
      done.textContent = t("reportSent");
      container.appendChild(done);
      return;
    }

    error.style.display = "block";
    submit.disabled = false;
    cancel.disabled = false;
    submit.textContent = t("reportSubmit");
  });

  actions.appendChild(cancel);
  actions.appendChild(submit);
  form.appendChild(actions);
  container.appendChild(form);
}
