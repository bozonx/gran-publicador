import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../../src/app.module.js';

/**
 * Creates a NestJS application for E2E testing.
 * Assumes database and redis are already running (set up via global-setup.ts)
 */
export async function createTestApp(): Promise<NestFastifyApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({
      logger: false,
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const basePath = (process.env.BASE_PATH ?? '').replace(/^\/+|\/+$/g, '');
  const globalPrefix = basePath ? `${basePath}/api/v1` : 'api/v1';
  app.setGlobalPrefix(globalPrefix);

  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return app;
}
