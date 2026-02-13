import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { readFileSync } from 'fs'
import { execSync } from 'child_process'

// Read version from package.json
const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'))

// Get git info for version display
function getGitInfo() {
  try {
    const commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
    const commitMessage = execSync('git log -1 --pretty=%s', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
    // Try to get tag
    let tag = ''
    try {
      tag = execSync('git describe --tags --exact-match', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
    } catch {
      // No tag on this commit
    }
    return { commitHash, branch, tag, commitMessage }
  } catch (e) {
    console.warn('Could not get git info:', e)
    return { commitHash: 'dev', branch: 'local', tag: '', commitMessage: '' }
  }
}

const gitInfo = getGitInfo()
// Version format: tag if exists, otherwise branch@commit
const appVersion = gitInfo.tag || `${gitInfo.branch}@${gitInfo.commitHash}`

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Fantacontratti',
        short_name: 'FC',
        description: 'Piattaforma per la gestione dei mercati del fantacalcio dinastico',
        start_url: '/',
        display: 'standalone',
        background_color: '#1a1d24',
        theme_color: '#4ade80',
        orientation: 'portrait-primary',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Cache static assets (CSS, JS, fonts, images)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            // Google Fonts
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // API calls - network first with offline fallback
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
              networkTimeoutSeconds: 10,
            },
          },
          {
            // Player images from API Football
            urlPattern: /^https:\/\/media\.api-sports\.io\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'player-images',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __GIT_COMMIT__: JSON.stringify(gitInfo.commitHash),
    __GIT_BRANCH__: JSON.stringify(gitInfo.branch),
    __GIT_COMMIT_MESSAGE__: JSON.stringify(gitInfo.commitMessage),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@services': path.resolve(__dirname, './src/services'),
      '@types': path.resolve(__dirname, './src/types'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@lib': path.resolve(__dirname, './src/lib'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
