/**
 * Vite build configuration for the Capacitor / Android bundle.
 *
 * Key differences from the standard vite.config.ts:
 *  - Does NOT require the PORT or BASE_PATH env vars (no dev server).
 *  - base is "/" so all asset references inside the APK are root-relative.
 *  - Output goes to dist/capacitor (separate from the Replit web build).
 *  - Replit-only plugins (cartographer, dev-banner) are excluded.
 *  - VITE_API_BASE_URL must be set to the deployed API origin so that
 *    fetch calls from the WebView reach the remote server.
 *
 * Usage:
 *   VITE_API_BASE_URL=https://your-app.repl.co \
 *     pnpm --filter @workspace/food-cost-app build:cap
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(
        import.meta.dirname,
        "..",
        "..",
        "attached_assets",
      ),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/capacitor"),
    emptyOutDir: true,
  },
});
