import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // "@/…" imports resolve to src/ (paths in tsconfig.json).
  resolve: { tsconfigPaths: true },
  server: { port: 5173 },
  // React + router + Radix make the shared chunk ~500 kB (≈160 kB gzipped), fine for a shop PC.
  // Pages load lazily on top of it (see app/router.tsx).
  build: { chunkSizeWarningLimit: 700 },
});
