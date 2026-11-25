import { defineConfig } from "vite";

export default defineConfig({
  publicDir: false,
  build: {
    outDir: "dist",
    emptyOutDir: false,
    sourcemap: false,
    lib: {
      entry: "src/content/dynamic-entry.ts",
      name: "AniListTrackerDynamic",
      formats: ["iife"],
      fileName: () => "content/dynamic.js",
    },
  },
});
