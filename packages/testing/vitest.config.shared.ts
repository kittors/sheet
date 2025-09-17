import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
  resolve: {
    alias: {
      '@sheet/core': path.resolve(__dirname, '../core/src'),
      '@sheet/renderer': path.resolve(__dirname, '../renderer/src'),
      '@sheet/ui': path.resolve(__dirname, '../ui/src'),
      '@sheet/shared-utils': path.resolve(__dirname, '../shared-utils/src'),
    },
  },
})
