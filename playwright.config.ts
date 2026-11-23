import { defineConfig, devices } from '@playwright/test'

const PORT = 4173

// Both browsers are supported (see PLAN.md), so e2e runs in Chromium and Firefox.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
  // A separate build with dev tools on (window.__keyflow, for sim injection), in its own
  // folder so it can never be mistaken for the production build in dist/.
  webServer: {
    command: `npx vite build --outDir dist-e2e && npx vite preview --outDir dist-e2e --port ${PORT} --strictPort`,
    env: { KEYFLOW_DEV_TOOLS: 'true' },
    port: PORT,
    reuseExistingServer: !process.env.CI,
  },
})
