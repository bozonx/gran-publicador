import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

/**
 * Prisma configuration for v7.
 */
export default defineConfig({
  schema: path.join(import.meta.dirname, 'prisma/schema.prisma'),
  datasource: {
    /**
     * Use DATABASE_URL from environment with a fallback for static analysis tools
     * (e.g. 'prisma generate'). The real value is required for migrations and runtime.
     */
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres',
  },
  migrations: {
    // Seed command for Prisma 7 (using --import for Node.js v20.6+)
    seed: 'node --import tsx prisma/seed.ts',
  },
});
