import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { fileURLToPath, URL } from 'node:url'
import type { ViteDevServer } from 'vite'
import type { IncomingMessage, ServerResponse } from 'http'

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
  assetsInclude: ['**/*.wasm'],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  // 配置中间件处理WASM文件
  configureServer(server: ViteDevServer) {
    server.middlewares.use('/EasyPlayer-pro.wasm', (req: IncomingMessage, res: ServerResponse, next: () => void) => {
      res.setHeader('Content-Type', 'application/wasm')
      next()
    })
    server.middlewares.use('/EasyPlayer-snap.wasm', (req: IncomingMessage, res: ServerResponse, next: () => void) => {
      res.setHeader('Content-Type', 'application/wasm')
      next()
    })
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    },
    fs: {
      allow: ['..'],
    },
    middlewareMode: false,
    proxy: {
      '/prod-api': {
        // 本地开发时使用 mock 服务器
        target: 'http://localhost:8080',
        // 连接车载WiFi时使用以下配置（取消注释并注释上面的target）
        // target: 'http://192.168.2.57',
        changeOrigin: true,
      },
      '/webrtc-api': {
        // 本地开发时使用 mock 服务器
        target: 'http://localhost:8080',
        // 连接车载WiFi时使用以下配置（取消注释并注释上面的target）
        // target: 'http://192.168.2.57',
        changeOrigin: true,
        ws: true,
      },
      '/easy-api': {
        // 本地开发时使用 mock 服务器
        target: 'http://localhost:8080',
        // 连接车载WiFi时使用以下配置（取消注释并注释上面的target）
        // target: 'http://192.168.2.57',
        changeOrigin: true,
      },
      // 流媒体代理配置
      '/stream': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        ws: true,
      },
    }
  }
})
