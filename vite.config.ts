import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import { readFileSync, existsSync } from "fs";
import manifest from "./public/manifest.json";
import pkg from "./package.json";

export default defineConfig(({ mode }) => {
  const manifestWithVersion: typeof manifest & { key?: string } = {
    ...manifest,
    version: pkg.version,
  };

  if (mode === "development" && existsSync("./dev-key.txt")) {
    manifestWithVersion.key = readFileSync("./dev-key.txt", "utf-8").trim();
  }

  return {
    plugins: [crx({ manifest: manifestWithVersion })],
    build: {
      outDir: "dist",
      emptyOutDir: true,
      sourcemap: false,
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