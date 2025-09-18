import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'html'],
      all: true,
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['**/__tests__/**', '**/*.d.ts']
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
