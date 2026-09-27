import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Two ways to run the page. `npm run dev` serves it here with hot reload and proxies the
// API (and the event stream) back to `applier serve`; `npm run build` writes dist/, which
// is committed and served by that same process, so using the tool needs no Node at all.
export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true, sourcemap: false },
  server: {
    port: 5174,
    proxy: {
      // The server sets X-Accel-Buffering itself, which is what keeps /api/events from
      // being buffered into uselessness on the way through.
      "/api": { target: "http://127.0.0.1:8765", changeOrigin: true },
    },
  },
});
