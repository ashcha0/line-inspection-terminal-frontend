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
        // 根据接口文档配置车载服务器地址
        target: 'http://192.168.2.57',
        changeOrigin: true,
        timeout: 30000, // 增加超时时间
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        }
      },
      '/webrtc-api': {
        // 根据接口文档配置流媒体服务器地址
        target: 'http://192.168.2.57',
        changeOrigin: true,
        ws: true,
        timeout: 30000,
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('webrtc proxy error', err);
          });
        }
      },
      '/easy-api': {
        // 根据接口文档配置摄像头服务器地址
        target: 'http://192.168.2.57',
        changeOrigin: true,
        timeout: 30000,
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('easy-api proxy error', err);
          });
        }
      }
    }
  }
})
