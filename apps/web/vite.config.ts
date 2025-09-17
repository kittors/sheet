import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'

export default defineConfig(({ mode }) => {
  // Allow loading env from monorepo root so you can place .env.development at repo root
  const envDir = path.resolve(__dirname, '../..')
  const env = loadEnv(mode, envDir, '') // load all keys, not only VITE_
  const port = Number(env.VITE_PORT || env.PORT || 5173)

  return {
    envDir,
    plugins: [vue()],
    resolve: {
      alias: {
        '@sheet/core': path.resolve(__dirname, '../../packages/core/src'),
        '@sheet/renderer': path.resolve(__dirname, '../../packages/renderer/src'),
        '@sheet/ui': path.resolve(__dirname, '../../packages/ui/src'),
        '@sheet/shared-utils': path.resolve(__dirname, '../../packages/shared-utils/src'),
      },
    },
    server: {
      port,
      strictPort: true, // hard fail if the port is taken to avoid confusion
      host: true,
      open: true,
    },
  }
})
