import { existsSync, mkdirSync } from 'node:fs';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client.js';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { getDatabaseUrl } from '../../config/database.config.js';
import { dirname } from 'path';


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

    let clientConfig: any = {};

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
      // PostgreSQL uses native driver by default, no adapter needed here
      // but we could use @prisma/adapter-pg if required
      internalLogger.log('🐘 Using PostgreSQL native client');
      // For PG, the URL is passed via environment or datasource property
      // But since we are using Prisma 7 and potentially overriding datasource in prisma.config.ts,
      // we don't need to do much here unless we want to use an adapter.
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
