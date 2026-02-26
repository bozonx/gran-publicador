import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'
import type { ConfigOptions } from '@nuxt/test-utils/playwright'

/**
 * Playwright configuration for Nuxt.
 * Docs: https://nuxt.com/docs/getting-started/testing#playwright
 */
export default defineConfig<ConfigOptions>({
  testDir: './test/e2e',
  timeout: 60 * 1000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    // Nuxt-specific configuration
    nuxt: {
      rootDir: fileURLToPath(new URL('.', import.meta.url)),
    },
    // Standard Playwright options
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
})
