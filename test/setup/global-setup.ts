import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';
import { Wait } from 'testcontainers';
import { execSync } from 'node:child_process';

/**
 * Global setup for E2E tests.
 * Runs once before all test suites.
 */
export default async function globalSetup() {
  console.log('\n--- Starting Global E2E Setup ---');

  const postgresContainer = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('test_db')
    .withUsername('test_user')
    .withPassword('test_password')
    .withWaitStrategy(Wait.forListeningPorts())
    .start();

  const redisContainer = await new RedisContainer('redis:7-alpine')
    .withWaitStrategy(Wait.forListeningPorts())
    .start();

  const dbUrl = postgresContainer.getConnectionUri();
  process.env.DATABASE_URL = dbUrl;
  process.env.REDIS_URL = `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}`;

  // Store containers for teardown
  (global as any).__POSTGRES_CONTAINER__ = postgresContainer;
  (global as any).__REDIS_CONTAINER__ = redisContainer;

  console.log(`Postgres: ${dbUrl}`);
  console.log(`Redis: ${process.env.REDIS_URL}`);

  console.log('Running migrations...');
  try {
    execSync('npx prisma migrate deploy', {
      env: { ...process.env, DATABASE_URL: dbUrl },
      stdio: 'inherit',
    });
  } catch (e) {
    console.error('Failed to run migrations in Global Setup');
    throw e;
  }

  console.log('--- Global E2E Setup Finished ---\n');
}
