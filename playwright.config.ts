import { defineConfig, devices } from '@playwright/test'

// One port per checkout, so task sessions running e2e in parallel worktrees never reuse each
// other's server (reuseExistingServer would silently test the other build).
// shortcut: two folders can hash to the same port (about 1 in 1000); give them different paths then.
const PORT =
  4173 + ([...process.cwd()].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0) % 1000)

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
    // Muted: tests start real audio, and it shouldn't come out of the speakers.
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--mute-audio'] } },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        launchOptions: { firefoxUserPrefs: { 'media.volume_scale': '0.0' } },
      },
    },
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
