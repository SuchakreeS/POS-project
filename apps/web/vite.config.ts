import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const API_TARGET = "http://localhost:4000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // "@/…" imports resolve to src/ (paths in tsconfig.json).
  resolve: { tsconfigPaths: true },
  server: {
    port: 5173,
    // Let testers open the dev server through a Cloudflare quick tunnel (*.trycloudflare.com).
    allowedHosts: [".trycloudflare.com"],
    // With VITE_API_URL="/api", API calls go through this dev server, so one tunnel serves both
    // the app and the API (see README → Testing with others). The refresh cookie's path is
    // rewritten to match, so login keeps working.
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
        cookiePathRewrite: { "/auth": "/api/auth" },
      },
    },
  },
  // React + router + Radix make the shared chunk ~500 kB (≈160 kB gzipped), fine for a shop PC.
  // Pages load lazily on top of it (see app/router.tsx).
  build: { chunkSizeWarningLimit: 700 },
});
