// Set environment variables BEFORE any imports to ensure they are available during config loading
process.env.DATA_DIR = process.env.DATA_DIR ?? './test-data';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-key-for-e2e-tests-minimum-32-chars';
process.env.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? 'test-token';
process.env.TELEGRAM_ADMIN_ID = process.env.TELEGRAM_ADMIN_ID ?? '123456789';
process.env.FREE_LLM_ROUTER_URL = process.env.FREE_LLM_ROUTER_URL ?? 'http://localhost:8080/llm';
process.env.SOCIAL_POSTING_SERVICE_URL =
  process.env.SOCIAL_POSTING_SERVICE_URL ?? 'http://localhost:8081/social';
process.env.MEDIA_STORAGE_SERVICE_URL =
  process.env.MEDIA_STORAGE_SERVICE_URL ?? 'http://localhost:8083/media';
process.env.NODE_ENV = 'test';

import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { REDIS_CLIENT } from '../../src/common/redis/redis.module.js';

export async function createTestApp(): Promise<NestFastifyApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(REDIS_CLIENT)
    .useValue({
      get: () => Promise.resolve(null),
      set: () => Promise.resolve('OK'),
      del: () => Promise.resolve(0),
      on: () => {},
      quit: () => Promise.resolve('OK'),
    })
    .overrideProvider(PrismaService)
    .useValue({
      $connect: async () => {},
      $disconnect: async () => {},
      onModuleInit: async () => {},
      onModuleDestroy: async () => {},
    })
    .overrideProvider(ConfigService)
    .useValue({
      get: (key: string) => {
        const config: Record<string, any> = {
          JWT_SECRET: 'test-secret-key',
          AUTH_JWT_SECRET: 'test-secret-key',
          TELEGRAM_BOT_TOKEN: 'test-bot-token',
          DATA_DIR: './test-data',
          NODE_ENV: 'test',
          app: {
            port: 8080,
            host: '0.0.0.0',
            basePath: '',
            nodeEnv: 'test',
            logLevel: 'silent',
            apiKey: 'test-api-key',
            jwtSecret: 'test-secret-key-for-e2e-tests-minimum-32-chars',
            telegramBotToken: 'test-bot-token',
            telegramBotEnabled: false,
            telegramSessionTtlMinutes: 10,
            frontendUrl: 'http://localhost:3000',
            telegramMiniAppUrl: 'https://t.me/test_bot/app',
            adminTelegramId: '123456789',
            media: {
              maxFileSize: 52428800,
            },
            shutdownTimeoutSeconds: 30,
            schedulerIntervalSeconds: 60,
            schedulerWindowMinutes: 10,
            microserviceRequestTimeoutSeconds: 30,
            timezone: 'UTC',
          },
          redis: {
            host: 'localhost',
            port: 6379,
            ttlMs: 3600000,
            db: 0,
          },
          llm: {
            serviceUrl: 'http://localhost:8080/llm',
            defaultTags: ['fast'],
          },
          stt: {
            serviceUrl: 'http://localhost:8081/stt',
          },
          translate: {
            serviceUrl: 'http://localhost:8082/translate',
          },
          media: {
            serviceUrl: 'http://localhost:8083/media',
          },
        };
        // Flatten keys manually for the mock or handle simple dot notation
        if (key.startsWith('app.')) {
          const subKey = key.split('.')[1];
          return config.app[subKey];
        }
        return config[key];
      },
    })
    .compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({
      logger: false, // We'll use Pino logger instead
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  // Ensure defaults the same as in main.ts
  const basePath = (process.env.BASE_PATH ?? '').replace(/^\/+|\/+$/g, '');
  const globalPrefix = basePath ? `${basePath}/api/v1` : 'api/v1';
  app.setGlobalPrefix(globalPrefix);

  await app.init();
  // Ensure Fastify has completed plugin registration and routing before tests
  await app.getHttpAdapter().getInstance().ready();
  return app;
}
