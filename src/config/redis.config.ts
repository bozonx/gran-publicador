import { plainToClass } from 'class-transformer';
import { IsInt, IsOptional, IsString, validateSync, Min, Max } from 'class-validator';
import { registerAs } from '@nestjs/config';

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
  public host: string = 'localhost';

  /**
   * Redis port.
   * Defined by REDIS_PORT environment variable.
   * Default: 6379
   */
  @IsInt()
  @Min(1)
  @Max(65535)
  public port: number = 6379;

  /**
   * Redis password.
   * Defined by REDIS_PASSWORD environment variable.
   */
  @IsOptional()
  @IsString()
  public password?: string;

  /**
   * Default TTL for cache in milliseconds.
   * Defined by REDIS_TTL_MS environment variable.
   * Default: 3600000 (1 hour)
   */
  @IsInt()
  @Min(0)
  public ttlMs: number = 3600000;

  /**
   * Redis database index.
   * Defined by REDIS_DB environment variable.
   * Default: 0
   */
  @IsInt()
  @Min(0)
  @Max(15)
  public db: number = 0;
}

export default registerAs('redis', (): RedisConfig => {
  const config = plainToClass(RedisConfig, {
    enabled: process.env.REDIS_ENABLED !== 'false',
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    ttlMs: process.env.REDIS_TTL_MS ? parseInt(process.env.REDIS_TTL_MS, 10) : 3600000,
    db: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : 0,
  });

  const errors = validateSync(config, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const errorMessages = errors.map(err => Object.values(err.constraints ?? {}).join(', '));
    throw new Error(`Redis config validation error: ${errorMessages.join('; ')}`);
  }

  return config;
});
