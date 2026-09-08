import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

function normalizeBasePath(value: string | undefined): string {
  if (!value) return '/'
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`
}

export default defineConfig(() => {
  const base = normalizeBasePath(process.env.VITE_BASE_PATH)
  const appIcon = `${base}app-icon.svg`

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['app-icon.svg'],
        manifest: {
          name: 'CEV CMMS',
          short_name: 'CEV CMMS',
          description: 'Quản lý thiết bị, bảo trì, kiểm tra, phụ tùng và hiệu chuẩn',
          lang: 'vi',
          start_url: base,
          scope: base,
          display: 'standalone',
          background_color: '#f8fafc',
          theme_color: '#0f172a',
          icons: [
            { src: appIcon, sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
            { src: appIcon, sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
          ],
        },
        workbox: {
          cleanupOutdatedCaches: true,
          navigateFallback: `${base}index.html`,
          globPatterns: ['**/*.{js,css,html,svg}'],
        },
      }),
    ],
  }
})
