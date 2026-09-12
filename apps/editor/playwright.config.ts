import { defineConfig, devices } from '@playwright/test'

const runtimes = ['development', 'production'] as const

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: runtimes.map((runtime, index) => ({
    name: runtime,
    use: { baseURL: `http://127.0.0.1:${3103 + index}` },
  })),
  webServer: runtimes.map((runtime, index) => ({
    command: `node tests/server.mjs ${runtime}`,
    url: `http://127.0.0.1:${3103 + index}`,
    reuseExistingServer: false,
    timeout: 120_000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
  })),
})
