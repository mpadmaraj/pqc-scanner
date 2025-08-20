
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve("./src"),
      "@shared": resolve("../shared"),
      "@assets": resolve("../attached_assets"),
    },
  },
  build: {
    outDir: resolve("../vercel-build"),
    emptyOutDir: true,
  },
});
