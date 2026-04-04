import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * App is served from this path (must start and end with `/`, or `/` for domain root).
 * Set env `VITE_BASE_PATH` when the SPA lives under a subpath, e.g. `/portal/` so
 * hard refresh loads `/assets/*` from the correct URL (avoids HTML-as-JS MIME errors).
 */
function vitePublicBase(): string {
  const raw = process.env.VITE_BASE_PATH?.trim()
  if (!raw || raw === "/") return "/"
  const withLead = raw.startsWith("/") ? raw : `/${raw}`
  return withLead.endsWith("/") ? withLead : `${withLead}/`
}

// https://vite.dev/config/
export default defineConfig({
  base: vitePublicBase(),
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5174,
    /** Forward `/api/*` to the Express API (default port matches backend `BACKEND_PORT` / 5004). */
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5004",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://127.0.0.1:5004",
        changeOrigin: true,
      },
    },
  },
})
