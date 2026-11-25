import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import { readFileSync, existsSync } from "fs";
import manifest from "./public/manifest.json";
import pkg from "./package.json";
import { getCatalog, toMatchPatterns } from "./src/sites/catalog";

export default defineConfig(({ mode }) => {
  const optionalHostPermissions = getCatalog(mode === "development")
    .filter((site) => site.access === "optional")
    .flatMap(toMatchPatterns);

  const manifestWithVersion: typeof manifest & { key?: string; optional_host_permissions?: string[] } = {
    ...manifest,
    version: pkg.version,
    ...(optionalHostPermissions.length > 0 ? { optional_host_permissions: optionalHostPermissions } : {}),
  };

  if (mode === "development") {
    if (existsSync("./dev-key.txt")) {
      manifestWithVersion.key = readFileSync("./dev-key.txt", "utf-8").trim();
    }
    manifestWithVersion.host_permissions = [
      ...manifest.host_permissions,
      "https://auth-dev.mraitchkovitch.fr/*",
    ];
    manifestWithVersion.icons = {
      "16": "icons-dev/icon16.png",
      "48": "icons-dev/icon48.png",
      "128": "icons-dev/icon128.png",
    };
    if (manifestWithVersion.action) {
      manifestWithVersion.action = {
        ...manifestWithVersion.action,
        default_icon: {
          "16": "icons-dev/icon16.png",
          "48": "icons-dev/icon48.png",
          "128": "icons-dev/icon128.png",
        },
      };
    }
  }

  return {
    plugins: [crx({ manifest: manifestWithVersion })],
    build: {
      outDir: "dist",
      emptyOutDir: true,
      sourcemap: false,
      modulePreload: false,
      rollupOptions: {
        input: {
          sites: "src/sites/sites.html",
          onboarding: "src/onboarding/onboarding.html",
        },
      },
    },
    server: {
      cors: true,
      hmr: {
        protocol: "ws",
        host: "localhost",
      },
    },
  };
});