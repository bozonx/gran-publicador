/**
 * Unit tests global setup
 *
 * Network handling:
 * - External network calls are blocked via nock to ensure test isolation
 * - Localhost connections are allowed for local adapters
 * - All nock interceptors are cleaned after each test
 *
 * Timeout:
 * - Global timeout for unit tests is configured in jest.config.ts (5 seconds)
 * - Override per-test if needed using jest.setTimeout() or passing timeout as third arg to it()
 */

import nock from 'nock';
import { beforeAll, afterEach, afterAll } from '@jest/globals';

// Block all external network calls; allow localhost for tests that use local adapters
beforeAll(() => {
  // Set required environment variables for tests
  process.env.DATA_DIR = './test-data';
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ?? 'postgresql://test:test@localhost:5432/test?schema=public';
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'unit-test-jwt-secret-minimum-32-characters';
  process.env.TELEGRAM_BOT_TOKEN = 'test-token';
  process.env.TELEGRAM_ADMIN_ID = '123456789';
  process.env.SOCIAL_POSTING_SERVICE_URL =
    process.env.SOCIAL_POSTING_SERVICE_URL ?? 'http://localhost:9999';

  nock.disableNetConnect();
  nock.enableNetConnect('127.0.0.1');
});

afterEach(() => {
  nock.cleanAll();
});

afterAll(() => {
  nock.enableNetConnect();
});
