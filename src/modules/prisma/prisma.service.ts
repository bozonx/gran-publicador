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
 * Database URL is automatically constructed from DATA_DIR environment variable.
 * DATA_DIR is REQUIRED - service will fail to initialize if not set.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  constructor() {
    // getDatabaseUrl() will throw if DATABASE_URL is not set
    const url = getDatabaseUrl();

    // Create a local logger instance for use before super()
    const internalLogger = new Logger(PrismaService.name);

    // Ensure the database directory exists if it's a file URL
    if (url.startsWith('file:')) {
      try {
        // Handle explicit file path or relative path
        // Remove file: prefix (and potentially // if present)
        const filePath = url.replace(/^file:\/\//, '').replace(/^file:/, '');
        const dbDir = dirname(filePath);
        if (!existsSync(dbDir)) {
           mkdirSync(dbDir, { recursive: true });
           internalLogger.log(`📁 Created database directory: ${dbDir}`);
        }
      } catch (err: any) {
        internalLogger.warn(`Could not ensure database directory exists: ${err.message}`);
      }
    }
    
    const adapter = new PrismaBetterSqlite3({ url });
    
    super({ adapter });

    // Log after super()
    this.logger.log(`🔌 Database URL: ${url}`);
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
