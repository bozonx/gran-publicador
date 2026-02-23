import { plainToClass } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min, Max } from 'class-validator';
import { registerAs } from '@nestjs/config';

const DEFAULT_REDIS_TTL_MS = 3600000; // 1 hour

/**
 * Configuration for Redis connection and caching.
 */
export class RedisConfig {
  @IsString()
  public url: string = 'redis://localhost:6379/0';

  /**
   * Default TTL for cache in milliseconds.
   * Default: 3600000 (1 hour)
   */
  @IsInt()
  @Min(0)
  public ttlMs: number = DEFAULT_REDIS_TTL_MS;

  /**
   * Redis key prefix.
   * Defined by REDIS_KEY_PREFIX environment variable.
   * Default: 'gran-p:'
   */
  @IsOptional()
  @IsString()
  public keyPrefix?: string = 'gran-p:';
}

export default registerAs('redis', (): RedisConfig => {
  const config = plainToClass(RedisConfig, {
    url: process.env.REDIS_URL || 'redis://localhost:6379/0',
    ttlMs: process.env.REDIS_TTL_MS ? parseInt(process.env.REDIS_TTL_MS, 10) : DEFAULT_REDIS_TTL_MS,
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'gran-p:',
  });

  return config;
});
