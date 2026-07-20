import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'Sound — offline FLAC player',
        short_name: 'Sound',
        description: 'Offline FLAC music library, Nothing OS style',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#000000',
        theme_color: '#000000',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ],
        // desktop installed PWA: lets the OS offer "Open with → Sound" for media files
        file_handlers: [
          {
            action: './',
            accept: {
              'audio/flac': ['.flac'],
              'audio/mpeg': ['.mp3'],
              'audio/mp4': ['.m4a'],
              'audio/aac': ['.aac'],
              'audio/ogg': ['.ogg', '.opus'],
              'audio/wav': ['.wav'],
              'video/mp4': ['.mp4', '.m4v'],
              'video/quicktime': ['.mov'],
              'video/webm': ['.webm']
            }
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024
      }
    })
  ]
});
