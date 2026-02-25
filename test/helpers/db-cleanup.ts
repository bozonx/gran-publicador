import type { PrismaService } from '../../src/modules/prisma/prisma.service.js';

/**
 * Truncates all tables in the database to ensure a clean state for tests.
 * Ignores system tables and the Prisma migration table.
 */
export async function truncateDatabase(prisma: PrismaService): Promise<void> {
  const models = Object.keys(prisma).filter(
    key =>
      typeof (prisma as any)[key] === 'object' && !(key.startsWith('$') || key.startsWith('_')),
  );

  // Get table names from models or use raw query to find all tables in public schema
  const tablenames = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename != '_prisma_migrations'
  `;

  for (const { tablename } of tablenames) {
    if (tablename !== '_prisma_migrations') {
      try {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "public"."${tablename}" CASCADE;`);
      } catch (error) {
        console.error(`Error truncating table ${tablename}:`, error);
      }
    }
  }
}
