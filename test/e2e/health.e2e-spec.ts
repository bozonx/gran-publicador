import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createTestApp } from './test-app.factory.js';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('Health (e2e)', () => {
  let app: NestFastifyApplication;

  beforeEach(async () => {
    // Create fresh app instance for each test for better isolation
    app = await createTestApp();
  });

  afterEach(async () => {
    // Clean up app instance after each test
    await app.close();
  });

  describe('GET /api/v1/health', () => {
    it('returns simple ok status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({ status: 'ok', database: 'connected' });
    });
  });
});
