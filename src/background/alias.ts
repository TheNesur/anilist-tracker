import { errMsg } from "../utils/dom";
import { getToken, getSettings } from "../utils/storage";
import { TOKEN_ENDPOINT } from "./oauth";
import type { AliasReportPayload, AliasSubmitPayload, MediaType } from "../types";

const ALIAS_LOOKUP_ENDPOINT = TOKEN_ENDPOINT.replace(/\/callback\/?$/, "/alias/lookup");
const ALIAS_SUBMIT_ENDPOINT = TOKEN_ENDPOINT.replace(/\/callback\/?$/, "/alias/submit");
const ALIAS_REPORT_ENDPOINT = TOKEN_ENDPOINT.replace(/\/callback\/?$/, "/alias/report");

export async function lookupAlias(
  alias: string,
  mediaType: MediaType
): Promise<{ mediaId: number; title: string } | null> {
  try {
    const response = await fetch(ALIAS_LOOKUP_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alias, mediaType }),
    });
    const data = await response.json().catch(() => null);
    if (data?.found) return { mediaId: data.mediaId, title: data.title };
    return null;
  } catch {
    return null;
  }
}

export async function submitAlias(params: AliasSubmitPayload): Promise<void> {
  const settings = await getSettings();
  if (!settings.contributeAliases) return;

  const token = await getToken();
  if (!token) return;

  try {
    await fetch(ALIAS_SUBMIT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    });
  } catch (err) {
    console.error("[AniList Tracker] Alias submit failed:", errMsg(err));
  }
}

export async function reportAlias(params: AliasReportPayload): Promise<{ success: boolean }> {
  const token = await getToken();
  if (!token) return { success: false };

  try {
    const response = await fetch(ALIAS_REPORT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    });
    const data = await response.json().catch(() => null);
    return { success: response.ok && data?.ok === true };
  } catch (err) {
    console.error("[AniList Tracker] Alias report failed:", errMsg(err));
    return { success: false };
  }
}
