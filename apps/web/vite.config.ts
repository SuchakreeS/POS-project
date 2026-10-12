import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // "@/…" imports resolve to src/ (paths in tsconfig.json).
  resolve: { tsconfigPaths: true },
  server: { port: 5173 },
});
