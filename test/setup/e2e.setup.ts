/**
 * E2E tests global setup
 */

import { jest, beforeAll, afterAll } from '@jest/globals';
import nock from 'nock';

beforeAll(() => {
  // We don't disableNetConnect() here because it might interfere with Docker/Testcontainers
  // communication if they use HTTP for metadata or other internal calls.
  // Instead, we trust our tests to mock what's needed.

  // Set default env vars for E2E
  process.env.NODE_ENV = 'test';
  process.env.DATA_DIR = './test-data-e2e';
  process.env.JWT_SECRET = 'test-secret-key-for-e2e-tests-minimum-32-chars';

  // Service URLs
  process.env.SOCIAL_POSTING_SERVICE_URL = 'http://social-service.test';
  process.env.FREE_LLM_ROUTER_URL = 'http://llm-service.test';
  process.env.TRANSLATE_SERVICE_URL = 'http://translate-service.test';
  process.env.STT_SERVICE_URL = 'http://stt-service.test';
  process.env.MEDIA_STORAGE_SERVICE_URL = 'http://media-service.test';
});

afterAll(() => {
  nock.cleanAll();
  nock.restore();
});

// Global timeout for E2E
jest.setTimeout(120000);
