import type { Config } from 'jest';

// Common module file extensions
const moduleFileExtensions = ['ts', 'js', 'json'];

// Common transform configuration
const transform = {
  '^.+\\.ts$': [
    'ts-jest',
    {
      tsconfig: 'tsconfig.spec.json',
      useESM: true,
    },
  ],
};

const config: Config = {
  extensionsToTreatAsEsm: ['.ts'],

  // Parallel test execution - use 50% of CPU cores locally, limit to 2 in CI
  maxWorkers: process.env.CI ? 2 : '25%',
  // Stop test execution on first failure in CI for faster feedback
  bail: process.env.CI ? 1 : 0,
  // Verbose output in CI for better debugging
  verbose: process.env.CI === 'true',

  projects: [
    // Unit tests configuration
    {
      displayName: 'unit',
      preset: 'ts-jest/presets/default-esm',
      testEnvironment: 'node',
      moduleFileExtensions,
      rootDir: '.',
      testMatch: ['<rootDir>/test/unit/**/*.spec.ts'],
      modulePathIgnorePatterns: ['<rootDir>/dist/'],
      testPathIgnorePatterns: ['<rootDir>/test/e2e/', '<rootDir>/dist/'],
      setupFilesAfterEnv: ['<rootDir>/test/setup/unit.setup.ts'],
      collectCoverageFrom: ['src/**/*.(t|j)s'],
      coverageDirectory: 'coverage',
      coveragePathIgnorePatterns: ['/node_modules/', '/dist/', '/test/', '.module.ts$', 'main.ts$'],
      transform,
      moduleNameMapper: {
        '^@gran/shared/permissions$': '<rootDir>/packages/shared/src/permissions.constants',
        '^@gran/shared/social-media-platforms$':
          '<rootDir>/packages/shared/src/social-media-platforms.constants',
        '^@gran/shared/archive$': '<rootDir>/packages/shared/src/archive.contracts',
        '^@gran/shared/api-tokens$': '<rootDir>/packages/shared/src/api-tokens.contracts',
        '^@gran/shared/llm$': '<rootDir>/packages/shared/src/llm.contracts',
        '^@gran/shared/post-statuses$': '<rootDir>/packages/shared/src/post-statuses.constants',
        '^@gran/shared/social-posting/tags-formatter$':
          '<rootDir>/packages/shared/src/social-posting/tags-formatter',
        '^@gran/shared/social-posting/body-formatter$':
          '<rootDir>/packages/shared/src/social-posting/body-formatter',
        '^@gran/shared/utils/(.*)$': '<rootDir>/packages/shared/src/utils/$1',
        '^(\\.{1,2}/.*)\\.js$': '$1',
      },
      // Global timeout for unit tests (default: 5 seconds)
      testTimeout: 5000,
    },
    // E2E tests configuration
    {
      displayName: 'e2e',
      preset: 'ts-jest/presets/default-esm',
      testEnvironment: 'node',
      moduleFileExtensions,
      rootDir: '.',
      testMatch: ['<rootDir>/test/e2e/health.e2e-spec.ts'],
      modulePathIgnorePatterns: ['<rootDir>/dist/'],
      setupFilesAfterEnv: ['<rootDir>/test/setup/e2e.setup.ts'],
      collectCoverageFrom: ['src/**/*.(t|j)s'],
      coverageDirectory: 'coverage',
      coveragePathIgnorePatterns: ['/node_modules/', '/dist/', '/test/', '.module.ts$', 'main.ts$'],
      transform,
      moduleNameMapper: {
        '^@gran/shared/permissions$': '<rootDir>/packages/shared/src/permissions.constants',
        '^@gran/shared/social-media-platforms$':
          '<rootDir>/packages/shared/src/social-media-platforms.constants',
        '^@gran/shared/archive$': '<rootDir>/packages/shared/src/archive.contracts',
        '^@gran/shared/api-tokens$': '<rootDir>/packages/shared/src/api-tokens.contracts',
        '^@gran/shared/llm$': '<rootDir>/packages/shared/src/llm.contracts',
        '^@gran/shared/post-statuses$': '<rootDir>/packages/shared/src/post-statuses.constants',
        '^@gran/shared/social-posting/tags-formatter$':
          '<rootDir>/packages/shared/src/social-posting/tags-formatter',
        '^@gran/shared/social-posting/body-formatter$':
          '<rootDir>/packages/shared/src/social-posting/body-formatter',
        '^@gran/shared/utils/(.*)$': '<rootDir>/packages/shared/src/utils/$1',
        '^(\\.{1,2}/.*)\\.js$': '$1',
      },
      // Global timeout for e2e tests (default: 30 seconds)
      testTimeout: 30000,
    },
  ],
};

export default config;
