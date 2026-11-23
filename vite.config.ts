import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const page = (path: string) => fileURLToPath(new URL(path, import.meta.url))

// VITE_BASE is set by the GitHub Pages workflow to "/<repo-name>/".
// Locally it defaults to "/".
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  build: {
    rolldownOptions: {
      input: {
        main: page('./index.html'),
        // P0-T2 hardware check spike. Deployed so Firefox's add-on prompt can be seen on a real
        // https origin. Remove with src/spike/ once P0-T3 lands.
        hardware: page('./spike/hardware.html'),
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
  },
})
