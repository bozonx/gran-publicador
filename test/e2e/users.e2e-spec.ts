import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createTestApp } from './test-app.factory.js';
import { describe, it, expect, beforeEach, beforeAll, afterAll } from '@jest/globals';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { truncateDatabase } from '../helpers/db-cleanup.js';
import { faker } from '@faker-js/faker';

describe('Users (e2e)', () => {
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

  describe('GET /api/v1/auth/me', () => {
    it('returns 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
      });

      expect(response.statusCode).toBe(401);
    });

    it('returns profile when authenticated via dev login', async () => {
      const telegramId = faker.number.int({ min: 100000, max: 999999 });

      // 1. Create user via dev login (or just create in DB)
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/dev',
        payload: { telegramId },
      });

      expect(loginResponse.statusCode).toBe(200);
      const { accessToken } = JSON.parse(loginResponse.payload);

      // 2. Get profile
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const profile = JSON.parse(response.payload);
      expect(Number(profile.telegramId)).toBe(telegramId);
    });
  });
});
