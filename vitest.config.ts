import { defineConfig } from 'vitest/config'
import viteReact from '@vitejs/plugin-react'
import path from 'path'

/**
 * Separate from vite.config.ts on purpose — that config wires in TanStack
 * Start (SSR + route codegen + prerendering), none of which unit tests need
 * or want running on every `vitest` invocation. Shares only what tests
 * actually need: the React plugin and the `@` -> src alias.
 */
export default defineConfig({
  plugins: [viteReact()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
