import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
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
