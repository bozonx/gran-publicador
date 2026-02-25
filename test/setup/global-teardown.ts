/**
 * Global teardown for E2E tests.
 */
export default async function globalTeardown() {
  console.log('\n--- Starting Global E2E Teardown ---');

  // Give a small delay for connections to drop naturally
  await new Promise(resolve => setTimeout(resolve, 500));

  if ((global as any).__POSTGRES_CONTAINER__) {
    console.log('Stopping Postgres container...');
    await (global as any).__POSTGRES_CONTAINER__.stop({ timeout: 5000 });
  }

  if ((global as any).__REDIS_CONTAINER__) {
    console.log('Stopping Redis container...');
    // We swallow potential Redis connection errors during container stop
    try {
      await (global as any).__REDIS_CONTAINER__.stop({ timeout: 5000 });
    } catch (e) {
      // Ignore socket closed errors during teardown
    }
  }

  console.log('--- Global E2E Teardown Finished ---');

  // Force exit to prevent hanging handles from keeping the process alive
  // (In some environments Ryuk or Redis handles might linger)
  process.exit(0);
}
