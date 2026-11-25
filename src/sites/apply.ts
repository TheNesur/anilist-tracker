import type { SupportedSite } from "../types";
import { hasSiteAccess, removeSiteAccess, requestSiteAccess } from "./access";
import { readEnabledSites, writeEnabledSites } from "./enabled";
import { getCatalogSite } from "./registry";

export interface ApplyResult {
  enabled: SupportedSite[];
  denied: SupportedSite[];
}

function isOptional(site: SupportedSite): boolean {
  return getCatalogSite(site)?.access === "optional";
}

export async function applySelection(selected: SupportedSite[]): Promise<ApplyResult> {
  const wanted = Array.from(new Set(selected)).filter((id) => getCatalogSite(id) !== null);
  const previous = await readEnabledSites();

  const missingAccess: SupportedSite[] = [];
  for (const site of wanted) {
    if (isOptional(site) && !(await hasSiteAccess(site))) missingAccess.push(site);
  }

  const accessRequest = missingAccess.length > 0 ? requestSiteAccess(missingAccess) : Promise.resolve(true);
  await writeEnabledSites(wanted);
  const granted = await accessRequest;

  let enabled = wanted;
  let denied: SupportedSite[] = [];
  if (!granted) {
    denied = missingAccess;
    enabled = wanted.filter((id) => !missingAccess.includes(id));
    await writeEnabledSites(enabled);
  }

  const dropped = previous.filter((id) => !wanted.includes(id) && isOptional(id));
  await removeSiteAccess(dropped);

  return { enabled, denied };
}

export async function setSiteEnabled(site: SupportedSite, enabled: boolean): Promise<ApplyResult> {
  const current = await readEnabledSites();
  const next = enabled ? [...current, site] : current.filter((id) => id !== site);
  return applySelection(next);
}
