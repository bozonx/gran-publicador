import { Global, Module } from '@nestjs/common';
import { ShutdownService } from './shutdown.service.js';

/**
 * Global module that provides ShutdownService to coordinate graceful shutdown.
 * Marked as @Global() so it's available throughout the application.
 */
@Global()
@Module({
  providers: [ShutdownService],
  exports: [ShutdownService],
})
export class ShutdownModule {}
