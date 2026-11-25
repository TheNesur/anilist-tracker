import { readFileSync } from "node:fs";

const frozen = JSON.parse(readFileSync(new URL("./frozen-manifest.json", import.meta.url), "utf-8"));
const built = JSON.parse(readFileSync(new URL("../dist/manifest.json", import.meta.url), "utf-8"));

const builtMatches = (built.content_scripts ?? []).flatMap((entry) => entry.matches ?? []);

const checks = [
  ["permissions", built.permissions ?? [], frozen.permissions],
  ["host_permissions", built.host_permissions ?? [], frozen.host_permissions],
  ["content_scripts.matches", builtMatches, frozen.content_scripts_matches],
];

let failed = false;
for (const [label, current, allowed] of checks) {
  const added = current.filter((entry) => !allowed.includes(entry));
  if (added.length > 0) {
    failed = true;
    console.error(`[check-permissions] ${label}: new entries would disable the extension on update:`);
    for (const entry of added) console.error(`  + ${entry}`);
  }
}

if (failed) {
  console.error("[check-permissions] Move new sites to optional_host_permissions (access: \"optional\" in src/sites/catalog.ts).");
  process.exit(1);
}

console.log("[check-permissions] OK: no new required permissions compared to 0.6.0.");
