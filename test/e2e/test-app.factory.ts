import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { Wait } from 'testcontainers';
import { execSync } from 'node:child_process';
import { AppModule } from '../../src/app.module.js';

let postgresContainer: StartedPostgreSqlContainer;
let redisContainer: StartedRedisContainer;

export async function createTestApp(): Promise<NestFastifyApplication> {
  // 1. Start Containers if not already started
  if (!postgresContainer) {
    postgresContainer = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('test_db')
      .withUsername('test_user')
      .withPassword('test_password')
      .withWaitStrategy(Wait.forListeningPorts())
      .start();

    const dbUrl = postgresContainer.getConnectionUri();
    process.env.DATABASE_URL = dbUrl;
    
    // Run migrations on the new container - ONLY ONCE
    try {
      execSync('npx prisma migrate deploy', {
        env: { ...process.env, DATABASE_URL: dbUrl },
      });
    } catch (e: any) {
      console.error('Migrations failed during E2E setup!');
      throw e;
    }
  }

  if (!redisContainer) {
    redisContainer = await new RedisContainer('redis:7-alpine').start();
    process.env.REDIS_URL = `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}`;
  }

  // 2. Build Module
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({
      logger: false,
    }),
  );

  // 3. Setup Global Middleware (matching main.ts)
  app.useGlobalPipes(
    new ValidationPipe({ 
      whitelist: true, 
      forbidNonWhitelisted: true, 
      transform: true 
    }),
  );

  const basePath = (process.env.BASE_PATH ?? '').replace(/^\/+|\/+$/g, '');
  const globalPrefix = basePath ? `${basePath}/api/v1` : 'api/v1';
  app.setGlobalPrefix(globalPrefix);

  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return app;
}

/**
 * Clean up containers after all tests
 */
export async function stopTestContainers() {
  if (postgresContainer) await postgresContainer.stop();
  if (redisContainer) await redisContainer.stop();
}
