import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/ccg_test/" : "/",
  publicDir: false,
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
