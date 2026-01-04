/**
 * E2E tests global setup
 *
 * Network handling:
 * - External network calls are allowed for e2e tests (unlike unit tests)
 * - If specific external calls must be mocked, do so per-test rather than globally
 *
 * Timeout:
 * - Global timeout for e2e tests is set to 30 seconds (see below)
 * - Override per-test if needed using jest.setTimeout() or passing timeout as third arg to it()
 */

import { jest } from '@jest/globals';
import { beforeAll } from '@jest/globals';

// Ensure necessary environment variables are set for E2E tests
beforeAll(() => {
  // Use a different data dir for E2E if desired, but './test-data' is fine
  process.env.DATA_DIR = process.env.DATA_DIR ?? './test-data';
  process.env.JWT_SECRET =
    process.env.JWT_SECRET ?? 'test-secret-key-for-e2e-tests-minimum-32-chars';
  process.env.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? 'test-token';
  // Note: we don't set NODE_ENV here as it might be set by CLI
});

// Set global timeout for all e2e tests to 30 seconds
// This prevents individual tests from needing to specify timeout manually
jest.setTimeout(30000);
