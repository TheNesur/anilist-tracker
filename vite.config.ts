import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./public/manifest.json";
import pkg from "./package.json";

const manifestWithVersion = { ...manifest, version: pkg.version };

export default defineConfig({
  plugins: [crx({ manifest: manifestWithVersion })],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    cors: true,
    hmr: {
      protocol: "ws",
      host: "localhost",
    },
  },
});