import { plainToClass } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min, Max } from 'class-validator';
import { registerAs } from '@nestjs/config';

const DEFAULT_REDIS_TTL_MS = 3600000; // 1 hour

/**
 * Configuration for Redis connection and caching.
 */
export class RedisConfig {
  /**
   * Whether Redis is enabled.
   * If disabled, the application will fall back to in-memory store.
   * Defined by REDIS_ENABLED environment variable.
   * Default: true
   */
  @IsOptional()
  public enabled: boolean = true;

  @IsString()
  public url: string = 'redis://localhost:6379/0';

  /**
   * Upstash REST API URL
   */
  @IsOptional()
  @IsString()
  public upstashRestUrl?: string;

  /**
   * Upstash REST API Token
   */
  @IsOptional()
  @IsString()
  public upstashRestToken?: string;

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
   * Default: undefined (no prefix)
   */
  @IsOptional()
  @IsString()
  public keyPrefix?: string;
}

export default registerAs('redis', (): RedisConfig => {
  const config = plainToClass(RedisConfig, {
    enabled: process.env.REDIS_ENABLED !== 'false',
    url: process.env.REDIS_URL || 'redis://localhost:6379/0',
    upstashRestUrl: process.env.UPSTASH_REDIS_REST_URL || undefined,
    upstashRestToken: process.env.UPSTASH_REDIS_REST_TOKEN || undefined,
    ttlMs: process.env.REDIS_TTL_MS ? parseInt(process.env.REDIS_TTL_MS, 10) : DEFAULT_REDIS_TTL_MS,
    keyPrefix: process.env.REDIS_KEY_PREFIX || undefined,
  });

  return config;
});
