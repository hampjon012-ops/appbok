import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    /** Lyssna på alla gränssnitt så localhost / 127.0.0.1 / LAN fungerar konsekvent */
    host: true,
    port: 5173,
    strictPort: false,
    headers: {
      'Cache-Control': 'no-store',
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        configure(proxy) {
          proxy.on('error', (_err, _req, res) => {
            if (res && !res.headersSent && typeof res.writeHead === 'function') {
              res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(
                JSON.stringify({
                  error:
                    'Utvecklings-API svarar inte (port 3001). Stoppa gamla processer (Ctrl+C), kör sedan npm run dev i mappen appbok-client.',
                })
              );
            }
          });
        },
      },
    },
  },
  preview: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        configure(proxy) {
          proxy.on('error', (_err, _req, res) => {
            if (res && !res.headersSent && typeof res.writeHead === 'function') {
              res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(
                JSON.stringify({
                  error:
                    'Utvecklings-API svarar inte (port 3001). Kör npm run dev i appbok-client (API + Vite).',
                })
              );
            }
          });
        },
      },
    },
  },
})
