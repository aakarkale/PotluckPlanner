import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

// Prefer a preinstalled Chromium (e.g. sandboxed CI images that ship one at
// $PLAYWRIGHT_BROWSERS_PATH/chromium) over downloading the pinned revision.
const preinstalledChromium = process.env.PLAYWRIGHT_BROWSERS_PATH
  ? `${process.env.PLAYWRIGHT_BROWSERS_PATH}/chromium`
  : undefined
const executablePath =
  preinstalledChromium && existsSync(preinstalledChromium) ? preinstalledChromium : undefined

// E2E runs against the production build served by `vite preview`, talking to
// a real local PostgREST + Postgres (see e2e/setup-local.sh).
const SUPABASE_URL = 'http://127.0.0.1:3002'
const ANON_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.MVPNNyBwd2n2FlEi424lOLPT0Z2W34D0wpiC6P_VZAg'

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node e2e/rest-shim.mjs',
      url: 'http://127.0.0.1:3002/health',
      reuseExistingServer: true,
    },
    {
      command: `VITE_SUPABASE_URL=${SUPABASE_URL} VITE_SUPABASE_ANON_KEY=${ANON_JWT} pnpm run build && pnpm run preview -- --port 4173 --strictPort`,
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
})
