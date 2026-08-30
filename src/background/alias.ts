import { errMsg } from "../utils/dom";
import { getToken, getStorage } from "../utils/storage";
import { TOKEN_ENDPOINT } from "./oauth";
import type { MediaDetection } from "../types";

const ALIAS_LOOKUP_ENDPOINT = TOKEN_ENDPOINT.replace(/\/callback\/?$/, "/alias/lookup");
const ALIAS_SUBMIT_ENDPOINT = TOKEN_ENDPOINT.replace(/\/callback\/?$/, "/alias/submit");

export async function lookupAlias(
  alias: string,
  mediaType: MediaDetection["mediaType"]
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

export async function submitAlias(params: {
  alias: string;
  mediaType: MediaDetection["mediaType"];
  mediaId: number;
  mediaTitle: string;
  sourceHostname: string | null;
}) {
  const settings = await getStorage();
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
