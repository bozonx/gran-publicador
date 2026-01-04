// Set environment variables BEFORE any imports to ensure they are available during config loading
process.env.DATA_DIR = process.env.DATA_DIR ?? './test-data';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-key-for-e2e-tests-minimum-32-chars';
process.env.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? 'test-token';
process.env.TELEGRAM_ADMIN_ID = process.env.TELEGRAM_ADMIN_ID ?? '123456789';
process.env.NODE_ENV = 'test';

import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';

export async function createTestApp(): Promise<NestFastifyApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
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
            adminTelegramId: '123456789',
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
