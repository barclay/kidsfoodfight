import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiProxyTarget = process.env.VITE_PROXY_TARGET ?? 'http://127.0.0.1:8000'
const usePolling = process.env.CHOKIDAR_USEPOLLING === 'true' || process.env.WATCHPACK_POLLING === 'true'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    ...(usePolling ? { watch: { usePolling: true, interval: 400 } } : {}),
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
})
