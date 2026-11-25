import type { SupportedSite } from "../types";
import { setSiteEnabled } from "../sites/apply";

export async function enableSiteFromPopup(site: SupportedSite): Promise<boolean> {
  const result = await setSiteEnabled(site, true);
  return result.denied.length === 0;
}
