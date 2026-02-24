/**
 * E2E tests global setup
 */

import { jest, beforeAll, afterAll } from '@jest/globals';
import nock from 'nock';

// Disable real network calls by default during E2E tests
beforeAll(() => {
  nock.disableNetConnect();
  // We allow localhost for Fastify inject and Testcontainers wait strategies
  nock.enableNetConnect(/(localhost|127\.0\.0\.1)/);

  // Set default env vars for E2E
  process.env.NODE_ENV = 'test';
  process.env.DATA_DIR = './test-data-e2e';
  process.env.JWT_SECRET = 'test-secret-key-for-e2e-tests-minimum-32-chars';
  
  // Service URLs (will be mocked by nock in tests)
  process.env.SOCIAL_POSTING_SERVICE_URL = 'http://social-service.test';
  process.env.FREE_LLM_ROUTER_URL = 'http://llm-service.test';
  process.env.TRANSLATE_SERVICE_URL = 'http://translate-service.test';
  process.env.STT_SERVICE_URL = 'http://stt-service.test';
  process.env.MEDIA_STORAGE_SERVICE_URL = 'http://media-service.test';
});

afterAll(() => {
  // nock.cleanAll();
  // nock.restore();
});

// Global timeout for E2E (containers and migrations can take time)
jest.setTimeout(120000);
