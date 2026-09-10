import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Mirrors the /api/ -> backend proxy used by nginx in the production
      // container, so the frontend can always call same-origin `/api/v1/...`.
      // No path rewrite: the backend mounts its router at /api/v1 itself.
      "/api": {
        target: process.env.VITE_API_BASE_URL || "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
})
