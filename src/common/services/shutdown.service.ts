import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Service responsible for coordinating graceful shutdown of the application.
 * Handles shutdown signals (SIGTERM, SIGINT) and ensures all resources are properly cleaned up.
 */
@Injectable()
export class ShutdownService implements OnApplicationShutdown {
  private readonly logger = new Logger(ShutdownService.name);
  private isShuttingDown = false;
  private shutdownTimeout: number;

  constructor(private readonly configService: ConfigService) {
    const appConfig = this.configService.get('app');
    this.shutdownTimeout = (appConfig?.shutdownTimeoutSeconds ?? 30) * 1000;
  }

  /**
   * Called by NestJS when application receives shutdown signal.
   * Coordinates graceful shutdown with timeout protection.
   */
  async onApplicationShutdown(signal?: string) {
    if (this.isShuttingDown) {
      this.logger.warn('Shutdown already in progress, ignoring duplicate signal');
      return;
    }

    this.isShuttingDown = true;
    this.logger.log(`Received shutdown signal: ${signal || 'UNKNOWN'}`);
    this.logger.log('Starting graceful shutdown...');

    const shutdownPromise = this.performShutdown();
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<void>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('Shutdown timeout exceeded'));
      }, this.shutdownTimeout);
    });

    try {
      await Promise.race([shutdownPromise, timeoutPromise]);
      clearTimeout(timeoutId!);
      this.logger.log('✅ Graceful shutdown completed successfully');
    } catch (error: any) {
      if (timeoutId!) clearTimeout(timeoutId);
      this.logger.error(`❌ Shutdown error: ${error.message}`, error.stack);
    }
  }

  /**
   * Performs the actual shutdown sequence.
   * NestJS will automatically call OnModuleDestroy hooks on all services.
   */
  private async performShutdown(): Promise<void> {
    this.logger.log('Waiting for all services to cleanup...');
    // Shutdown sequence is handled by NestJS lifecycle hooks (OnModuleDestroy)
    // This method can be extended for custom cleanup logic if needed
  }

  /**
   * Check if shutdown is currently in progress.
   */
  isShutdownInProgress(): boolean {
    return this.isShuttingDown;
  }
}
