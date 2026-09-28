import { existsSync } from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { localMapApi } from './server/local-map-api.js'

// Vercel rewrites each route to its own prerendered index.html. Without this,
// `vite preview` serves the home page for paths lacking a trailing slash.
function prerenderedRoutes() {
  return {
    name: 'prerendered-routes',
    configurePreviewServer(server) {
      const outDir = path.resolve(server.config.root, server.config.build.outDir)
      server.middlewares.use((request, response, next) => {
        const url = new URL(request.url, 'http://localhost')
        const route = url.pathname.replace(/\/+$/, '')
        if (route && !path.extname(route) && existsSync(path.join(outDir, route, 'index.html'))) request.url = `${route}/index.html${url.search}`
        next()
      })
    },
  }
}

export default defineConfig({
  build: { manifest: true },
  plugins: [localMapApi(), prerenderedRoutes(), react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
