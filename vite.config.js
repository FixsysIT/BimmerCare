import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Served from a project subpath on GitHub Pages: https://saddikh.github.io/BimmerCare/
export default defineConfig({
  base: '/BimmerCare/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'BimmerCare',
        short_name: 'BimmerCare',
        description: 'BMW F10 523i N53 Maintenance Tracker',
        theme_color: '#0D1117',
        background_color: '#0D1117',
        display: 'standalone',
        scope: '/BimmerCare/',
        start_url: '/BimmerCare/',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
})
