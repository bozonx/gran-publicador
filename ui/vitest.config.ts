import { defineConfig } from 'vitest/config';
import { defineVitestProject } from '@nuxt/test-utils/config';
import { fileURLToPath } from 'node:url';

export default defineConfig(async () => ({
  resolve: {
    alias: {
      '~/': fileURLToPath(new URL('./app/', import.meta.url)),
      '@/': fileURLToPath(new URL('./app/', import.meta.url)),
      '~': fileURLToPath(new URL('./app', import.meta.url)),
      '@': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
  test: {
    hookTimeout: 30_000,
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: 'coverage',
    },
    projects: [
      await defineVitestProject({
        test: {
          name: 'unit',
          include: ['test/unit/**/*.{test,spec}.ts'],
          environment: 'happy-dom',
          setupFiles: ['test/setup/unit.setup.ts'],
          hookTimeout: 30_000,
          testTimeout: 30_000,
        },
      }),
      await defineVitestProject({
        test: {
          name: 'nuxt',
          include: ['test/nuxt/**/*.{test,spec}.ts'],
          environment: 'nuxt',
          hookTimeout: 60_000,
          testTimeout: 60_000,
        },
      }),
      {
        test: {
          name: 'e2e',
          include: ['test/e2e/**/*.{test,spec}.ts'],
          environment: 'node',
          hookTimeout: 60_000,
          testTimeout: 60_000,
        },
      },
    ],
  },
}));
