import { Controller, Get } from '@nestjs/common';

/**
 * Health check controller.
 * Provides endpoints to verify the application's readiness and liveness.
 */
@Controller('health')
export class HealthController {
  /**
   * Basic health check endpoint returning a simple OK status
   */
  @Get()
  public check() {
    return { status: 'ok' };
  }
}
