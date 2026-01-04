import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client.js';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { getDatabaseUrl } from '../../config/database.config.js';

/**
 * Service that extends PrismaClient to handle database connections.
 * Manages lifecycle events for connection and disconnection.
 * Uses better-sqlite3 adapter for Prisma 7 compatibility.
 * Database URL is automatically constructed from DATA_DIR environment variable.
 * DATA_DIR is REQUIRED - service will fail to initialize if not set.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // getDatabaseUrl() will throw if DATA_DIR is not set
    const url = getDatabaseUrl();
    
    const adapter = new PrismaBetterSqlite3({ url });
    
    super({ adapter });
  }

  public async onModuleInit() {
    await this.$connect();
  }

  public async onModuleDestroy() {
    await this.$disconnect();
  }
}
