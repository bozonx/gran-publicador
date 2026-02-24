import { plainToClass } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { registerAs } from '@nestjs/config';

/**
 * Configuration for BullMQ workers and queues.
 * Optimizing these values can significantly reduce Redis command usage.
 */
export class BullMQConfig {
  /**
   * Interval at which the worker will check for stalled jobs.
   * Increasing this reduces the number of commands sent to Redis.
   * Default: 30000 (30 seconds)
   */
  @IsOptional()
  @IsInt()
  @Min(5000)
  public stalledCheckInterval: number = 30000;

  /**
   * Duration of the lock for a job.
   * Should be longer than the maximum expected processing time.
   * Default: 30000 (30 seconds)
   */
  @IsOptional()
  @IsInt()
  @Min(5000)
  public lockDuration: number = 30000;

  /**
   * Default concurrency for processors.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  public defaultConcurrency: number = 5;

  /**
   * Max stalled count before a job is marked as failed.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  public maxStalledCount: number = 1;
}

export default registerAs('bullmq', (): BullMQConfig => {
  const config = plainToClass(BullMQConfig, {
    stalledCheckInterval: process.env.BULL_STALLED_CHECK_INTERVAL
      ? parseInt(process.env.BULL_STALLED_CHECK_INTERVAL, 10)
      : 30000,
    lockDuration: process.env.BULL_LOCK_DURATION
      ? parseInt(process.env.BULL_LOCK_DURATION, 10)
      : 30000,
    defaultConcurrency: process.env.BULL_CONCURRENCY
      ? parseInt(process.env.BULL_CONCURRENCY, 10)
      : 5,
    maxStalledCount: process.env.BULL_MAX_STALLED_COUNT
      ? parseInt(process.env.BULL_MAX_STALLED_COUNT, 10)
      : 1,
  });

  return config;
});
