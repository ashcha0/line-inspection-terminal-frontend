import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
    }),
    Components({
      resolvers: [ElementPlusResolver()],
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/prod-api': {
        // 本地开发时使用 mock 服务器
        target: 'http://localhost:8081',
        // 连接车载WiFi时使用以下配置（取消注释并注释上面的target）
        // target: 'http://192.168.2.2',
        changeOrigin: true,
      },
      '/webrtc-api': {
        // 本地开发时使用 mock 服务器
        target: 'http://localhost:8081',
        // 连接车载WiFi时使用以下配置（取消注释并注释上面的target）
        // target: 'http://192.168.2.2',
        changeOrigin: true,
        ws: true,
      },
    }
  }
})
