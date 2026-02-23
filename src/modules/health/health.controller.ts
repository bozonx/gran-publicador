import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AppConfig } from '../../config/app.config.js';

/**
 * Health check controller.
 * Provides endpoints to verify the application's readiness and liveness.
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Basic health check endpoint returning status and database connection state
   */
  @Get()
  public async check() {
    const appConfig = this.configService.get<AppConfig>('app')!;
    const version = appConfig.version;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', version, database: 'connected' };
    } catch (error) {
      return {
        status: 'ok',
        version,
        database: 'disconnected',
        error: (error as Error).message,
      };
    }
  }
}
