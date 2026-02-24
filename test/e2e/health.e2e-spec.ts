import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createTestApp } from './test-app.factory.js';
import { describe, it, expect, beforeEach, beforeAll, afterAll } from '@jest/globals';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { truncateDatabase } from '../helpers/db-cleanup.js';

describe('Health (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await truncateDatabase(prisma);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe('GET /api/v1/health', () => {
    it('returns simple ok status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({ status: 'ok', database: 'connected', version: '0.5.0' });
    });
  });
});
