import type { CatalogParser } from "../../types";
import { RaijinCatalogParser } from "./raijin";

export function getCatalogParser(): CatalogParser | null {
  const host = window.location.hostname.replace("www.", "");

  if (host.includes("raijin-scans") || host.includes("raijinscan")) return new RaijinCatalogParser();

  return null;
}