import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { productionPublicAssets } from './publicAssets.mjs'
import { claimScanAssets } from './claimScanAssets.mjs'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  publicDir: command === 'build' ? false : 'public',
  resolve: { dedupe: ['react', 'react-dom'] },
  plugins: [react(), tailwindcss(), productionPublicAssets(), claimScanAssets()],
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: ['.railway.app', 'money.davit-fin.co.il', 'networth.davit-fin.co.il'],
  },
}))
