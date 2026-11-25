import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// VITE_BASE is set by the GitHub Pages workflow to "/<repo-name>/".
// Locally it defaults to "/".
export default defineConfig(({ command }) => ({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  define: {
    // Dev tools (window.__keyflow, the event inspector) exist in the dev server and in builds
    // made with KEYFLOW_DEV_TOOLS=true (the Playwright build). A literal boolean lets the
    // production build drop them entirely; CI checks that it did.
    __KEYFLOW_DEV_TOOLS__: JSON.stringify(
      command === 'serve' || process.env.KEYFLOW_DEV_TOOLS === 'true',
    ),
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
}))
