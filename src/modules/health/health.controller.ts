import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Health check controller.
 * Provides endpoints to verify the application's readiness and liveness.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Basic health check endpoint returning status and database connection state
   */
  @Get()
  public async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'connected' };
    } catch (error) {
      return { status: 'ok', database: 'disconnected', error: (error as Error).message };
    }
  }
}
