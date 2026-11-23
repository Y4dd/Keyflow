import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// VITE_BASE is set by the GitHub Pages workflow to "/<repo-name>/".
// Locally it defaults to "/".
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
  },
})
