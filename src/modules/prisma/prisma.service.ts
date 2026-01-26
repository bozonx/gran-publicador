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

  constructor() {
    const url = getDatabaseUrl();
    const internalLogger = new Logger(PrismaService.name);

    const clientConfig: any = {};

    // Use @prisma/adapter-pg for PostgreSQL (required for Prisma 7 with config file)
    if (url.startsWith('postgresql://') || url.startsWith('postgres://')) {
      const pool = new Pool({ connectionString: url });
      const adapter = new PrismaPg(pool);
      clientConfig.adapter = adapter;
      internalLogger.log('🐘 Using PostgreSQL with @prisma/adapter-pg');
    } else {
      throw new Error(
        `Unsupported database protocol. Expected postgresql:// or postgres://, got: ${url.split(':')[0]}`,
      );
    }

    super(clientConfig);

    this.logger.log(`🔌 Database connected via: ${url.split('@').pop()}`); // Log URL without credentials
  }

  public async onModuleInit() {
    await this.$connect();
  }

  public async onModuleDestroy() {
    this.logger.log('Closing database connection...');
    try {
      await this.$disconnect();
      this.logger.log('✅ Database connection closed');
    } catch (error: any) {
      this.logger.error(`❌ Error closing database connection: ${error.message}`, error.stack);
      throw error;
    }
  }
}
