import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/index.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { getDatabaseUrl } from '../../config/database.config.js';

const { Pool } = pg;

/**
 * Service that extends PrismaClient to handle database connections.
 * Manages lifecycle events for connection and disconnection.
 * Uses @prisma/adapter-pg for PostgreSQL compatibility.
 * Database URL is automatically retrieved from DATABASE_URL environment variable.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private pool?: pg.Pool;

  constructor() {
    const url = getDatabaseUrl();
    const internalLogger = new Logger(PrismaService.name);

    const clientConfig: any = {};
    let pool: pg.Pool | undefined;

    // Use @prisma/adapter-pg for PostgreSQL (required for Prisma 7 with config file)
    if (url.startsWith('postgresql://') || url.startsWith('postgres://')) {
      const parsedUrl = new URL(url);
      const isSsl =
        parsedUrl.searchParams.get('sslmode') === 'require' ||
        parsedUrl.searchParams.get('ssl') === 'true';

      const poolConfig: pg.PoolConfig = {
        connectionString: url,
      };

      // Explicitly enable SSL if requested in URL
      // This ensures pg driver respects the setting even if connectionString parsing varies
      if (isSsl) {
        poolConfig.ssl = {
          rejectUnauthorized: false, // Allow self-signed or incomplete cert chains typical in some cloud envs
        };
        internalLogger.log('🔒 SSL/TLS explicitly enabled for PostgreSQL pool');
      }

      pool = new Pool(poolConfig);
      const adapter = new PrismaPg(pool);
      clientConfig.adapter = adapter;
      
      internalLogger.log('🐘 Using PostgreSQL with @prisma/adapter-pg');
      internalLogger.log(`🔌 Database Host: ${parsedUrl.hostname}`);
      internalLogger.log(`🔌 Database Name: ${parsedUrl.pathname.slice(1)}`);
      internalLogger.log(`🔌 Database User: ${parsedUrl.username}`);
    } else {
      throw new Error(
        `Unsupported database protocol. Expected postgresql:// or postgres://, got: ${url.split(':')[0]}`,
      );
    }

    super(clientConfig);

    this.pool = pool;
  }

  public async onModuleInit() {
    await this.$connect();
  }

  public async onModuleDestroy() {
    this.logger.log('Closing database connection...');
    try {
      await this.$disconnect();
      await this.pool?.end();
      this.logger.log('✅ Database connection closed');
    } catch (error: any) {
      this.logger.error(`❌ Error closing database connection: ${error.message}`, error.stack);
      throw error;
    }
  }
}
