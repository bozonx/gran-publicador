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
  const url = process.env.REDIS_URL;
  const host = process.env.REDIS_HOST;
  const port = process.env.REDIS_PORT || '6379';
  const password = process.env.REDIS_PASSWORD;
  const db = process.env.REDIS_DB || '0';

  let finalUrl = url;
  if (!finalUrl && host) {
    const auth = password ? `:${password}@` : '';
    finalUrl = `redis://${auth}${host}:${port}/${db}`;
  }

  const config = plainToClass(RedisConfig, {
    url: finalUrl || 'redis://localhost:6379/0',
    ttlMs: process.env.REDIS_TTL_MS ? parseInt(process.env.REDIS_TTL_MS, 10) : DEFAULT_REDIS_TTL_MS,
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'gran-p:',
  });

  return config;
});
