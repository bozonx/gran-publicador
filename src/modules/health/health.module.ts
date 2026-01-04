import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';

/**
 * Module responsible for health check endpoints.
 */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
