import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueJsx(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/byteplus-api': {
        target: 'https://ark.ap-southeast.bytepluses.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/byteplus-api/, '')
      },
      '/mst-api': {
        target: 'https://api.vietqr.io/v2/business',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/mst-api/, '')
      }
    }
  }
})
