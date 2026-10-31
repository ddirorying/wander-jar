import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json'

// GitHub Pages 주소가 https://ddirorying.github.io/wander-jar/ 이라서 base 를 맞춰 둡니다.
export default defineConfig({
  base: '/wander-jar/',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Wander Jar',
        short_name: 'Wander Jar',
        description: '가고 싶은 여행지를 모아두는 버킷리스트 & 무드보드',
        lang: 'ko',
        start_url: '/wander-jar/',
        scope: '/wander-jar/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f3eee4',
        theme_color: '#f3eee4',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 한글 글꼴 조각(woff2)은 미리 다 받지 않고, 실제로 쓰인 조각만 처음 볼 때 저장합니다.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'wj-fonts',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            // 지도 타일·글꼴·스타일: 한 번 본 지역은 오프라인에서도 보이게
            urlPattern: ({ url }) => url.hostname === 'tiles.openfreemap.org' && url.pathname.startsWith('/styles/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'wj-map-style', cacheableResponse: { statuses: [0, 200] } },
          },
          {
            urlPattern: ({ url }) => url.hostname === 'tiles.openfreemap.org',
            handler: 'CacheFirst',
            options: {
              cacheName: 'wj-map',
              expiration: { maxEntries: 3000, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // 링크로 저장한 사진: 한 번 본 사진은 오프라인에서도 보이게
            urlPattern: ({ request, sameOrigin }) => !sameOrigin && request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'wj-remote-images',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 180 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
