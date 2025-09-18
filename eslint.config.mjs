// Flat ESLint config for monorepo (TS + Vue 3 + Vitest)
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import vue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'
import vitest from 'eslint-plugin-vitest'
import globals from 'globals'
import prettier from 'eslint-config-prettier'

export default [
  // Ignore build artifacts and generated content
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '.turbo/**',
      'apps/web/test-results/**',
    ],
  },

  // Base JS rules
  js.configs.recommended,

  // TypeScript rules (no type-aware to keep lint fast and simple)
  ...tseslint.configs.recommended,

  // Vue 3 SFC rules
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        ecmaVersion: 2022,
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
      },
      globals: { ...globals.browser },
    },
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },

  // Test files (Vitest)
  {
    files: ['**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    plugins: { vitest },
    rules: {
      ...vitest.configs.recommended.rules,
    },
    languageOptions: {
      globals: { ...globals.node, ...globals.browser, ...globals.vitest },
    },
  },

  // Project-wide language options and small rule tweaks
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'no-console': 'warn',
      'no-debugger': 'warn',
    },
  },

  // Disable formatting-related rules in favor of Prettier
  prettier,
]
