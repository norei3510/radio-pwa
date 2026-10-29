import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => ({
  define: {
    __RADIO_CATALOG__: readFileSync(new URL('./public/catalog.json', import.meta.url), 'utf8'),
  },
  base: mode === 'production' ? '/radio-pwa/' : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      manifest: {
        name: 'Radio Desk',
        short_name: 'Radio Desk',
        description: '3番組の新着音源を自動で蓄積するラジオPWA',
        start_url: './',
        display: 'standalone',
        background_color: '#f4efe6',
        theme_color: '#f4efe6',
        lang: 'ja',
        icons: [
          {
            src: 'icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,webmanifest}'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.toLowerCase().endsWith('.mp3'),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
}));
