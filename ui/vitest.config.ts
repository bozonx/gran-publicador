import { defineConfig } from 'vitest/config';
import { defineVitestProject } from '@nuxt/test-utils/config';

export default defineConfig(async () => ({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: 'coverage',
    },
    projects: [
      {
        test: {
          name: 'unit',
          include: ['test/unit/**/*.{test,spec}.ts'],
          environment: 'happy-dom',
          setupFiles: ['test/setup/unit.setup.ts'],
        },
      },
      await defineVitestProject({
        test: {
          name: 'nuxt',
          include: ['test/nuxt/**/*.{test,spec}.ts'],
          environment: 'nuxt',
        },
      }),
      {
        test: {
          name: 'e2e',
          include: ['test/e2e/**/*.{test,spec}.ts'],
          environment: 'node',
        },
      },
    ],
  },
}));
