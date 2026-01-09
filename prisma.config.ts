import 'dotenv/config'; // Load variables from .env if present
import path from 'node:path';
import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// In production (Docker), the compiled code is in dist/src
// In development, the code is in src
const configPath = existsSync('./dist/src/config/database.config.js')
  ? './dist/src/config/database.config.js'
  : './src/config/database.config.js';

const { getDatabaseUrl } = await import(configPath);

/**
 * Prisma configuration for v7.
 */
export default defineConfig({
  schema: path.join(import.meta.dirname, 'prisma/schema.prisma'),
  datasource: {
    // getDatabaseUrl() will throw if DATABASE_URL is not set
    url: getDatabaseUrl(),
  },
  migrations: {
    // Seed command for Prisma 7 (using --import for Node.js v20.6+)
    seed: 'node --import tsx prisma/seed.ts',
  },
});
