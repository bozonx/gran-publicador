import { existsSync, mkdirSync } from 'node:fs';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client.js';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { getDatabaseDirectory, getDatabaseUrl } from '../../config/database.config.js';

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
    // Ensure the database directory exists
    const dbDir = getDatabaseDirectory();
    const dbDirExists = existsSync(dbDir);
    if (!dbDirExists) {
      mkdirSync(dbDir, { recursive: true });
    }

    // getDatabaseUrl() will throw if DATA_DIR is not set
    const url = getDatabaseUrl();
    
    const adapter = new PrismaBetterSqlite3({ url });
    
    super({ adapter });

    if (!dbDirExists) {
       this.logger.log(`📁 Created database directory: ${dbDir}`);
    }
    
    // Log after super()
    this.logger.log(`🔌 Database URL: ${url}`);
    this.logger.log(`📁 DATA_DIR: ${process.env.DATA_DIR}`);
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
