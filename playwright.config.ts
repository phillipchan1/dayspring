import { defineConfig, devices } from '@playwright/test'

/**
 * Browser regression suite for the writing surface (e2e/).
 *
 * The specs drive the real `Editor` mounted alone on e2e/harness/, served by
 * Vite. Two projects:
 *
 *  · `ipad-chromium` — Chromium at an iPad viewport with touch, telling
 *    CodeMirror it is on iOS (see e2e/ios.ts), so its iOS-only input paths run.
 *    Runs anywhere, including cloud sandboxes that have no WebKit build.
 *  · `ipad-webkit` — Playwright's WebKit with the iPad descriptor. The real
 *    engine; run it on a Mac (`npx playwright install webkit` once).
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5181',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'ipad-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 820, height: 1180 },
        hasTouch: true,
        userAgent:
          'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      },
    },
    {
      name: 'ipad-webkit',
      use: { ...devices['iPad (gen 7)'] },
    },
  ],
  webServer: {
    command: 'npx vite --port 5181 --strictPort',
    url: 'http://localhost:5181/e2e/harness/index.html',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
