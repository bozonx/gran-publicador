import { existsSync, mkdirSync } from 'node:fs';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client.js';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { getDatabaseUrl } from '../../config/database.config.js';
import { dirname } from 'path';

const { Pool } = pg;

/**
 * Service that extends PrismaClient to handle database connections.
 * Manages lifecycle events for connection and disconnection.
 * Uses better-sqlite3 adapter for Prisma 7 compatibility.
 * Database URL is automatically constructed from DATABASE_URL environment variable.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  constructor() {
    const url = getDatabaseUrl();
    const internalLogger = new Logger(PrismaService.name);

    const clientConfig: any = {};

    // SQLite detection and setup
    if (url.startsWith('file:') || url.includes('.db')) {
      try {
        const filePath = url.replace(/^file:\/\//, '').replace(/^file:/, '');
        const dbDir = dirname(filePath);
        if (!existsSync(dbDir)) {
          mkdirSync(dbDir, { recursive: true });
          internalLogger.log(`📁 Created database directory: ${dbDir}`);
        }
      } catch (err: any) {
        internalLogger.warn(`Could not ensure database directory exists: ${err.message}`);
      }

      // Use better-sqlite3 adapter for SQLite
      const adapter = new PrismaBetterSqlite3({ url });
      clientConfig.adapter = adapter;
      internalLogger.log('📦 Using SQLite with better-sqlite3 adapter');
    } else if (url.startsWith('postgresql://') || url.startsWith('postgres://')) {
      // Use @prisma/adapter-pg for PostgreSQL (required for Prisma 7 with config file)
      const pool = new Pool({ connectionString: url });
      const adapter = new PrismaPg(pool);
      clientConfig.adapter = adapter;
      internalLogger.log('🐘 Using PostgreSQL with @prisma/adapter-pg');
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
