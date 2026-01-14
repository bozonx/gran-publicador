import { plainToClass } from 'class-transformer';
import { IsInt, Min, Max, validateSync, IsString, IsUrl, IsOptional } from 'class-validator';
import { registerAs } from '@nestjs/config';

/**
 * Configuration for Translate Gateway microservice integration.
 */
export class TranslateConfig {
  /**
   * URL of the Translate Gateway microservice.
   * Defined by TRANSLATE_SERVICE_URL environment variable.
   * Example: http://localhost:8080/api/v1
   */
  @IsString()
  @IsUrl({ require_tld: false })
  public serviceUrl!: string;

  /**
   * Default translation provider.
   * Defined by TRANSLATE_DEFAULT_PROVIDER environment variable.
   * Example: anylang, google, deepl, etc.
   */
  @IsOptional()
  @IsString()
  public defaultProvider?: string;

  /**
   * Default model for the provider.
   * Defined by TRANSLATE_DEFAULT_MODEL environment variable.
   */
  @IsOptional()
  @IsString()
  public defaultModel?: string;

  /**
   * Request timeout in seconds.
   * Defined by TRANSLATE_TIMEOUT_SEC environment variable.
   * Range: 1-600 seconds.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  public timeoutSec?: number;

  /**
   * Maximum allowed input text length.
   * Defined by TRANSLATE_MAX_TEXT_LENGTH environment variable.
   * Range: 100-10000000 characters.
   */
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(10000000)
  public maxTextLength?: number;

  /**
   * Maximum retry attempts.
   * Defined by TRANSLATE_RETRY_MAX_ATTEMPTS environment variable.
   * Range: 0-30.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  public retryMaxAttempts?: number;

  /**
   * Initial retry delay in milliseconds.
   * Defined by TRANSLATE_RETRY_INITIAL_DELAY_MS environment variable.
   * Range: 0-600000 ms.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(600000)
  public retryInitialDelayMs?: number;

  /**
   * Maximum retry delay in milliseconds.
   * Defined by TRANSLATE_RETRY_MAX_DELAY_MS environment variable.
   * Range: 0-600000 ms.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(600000)
  public retryMaxDelayMs?: number;
}

export default registerAs('translate', (): TranslateConfig => {
  const config = plainToClass(TranslateConfig, {
    serviceUrl: process.env.TRANSLATE_SERVICE_URL || 'http://localhost:8080/api/v1',
    defaultProvider: process.env.TRANSLATE_DEFAULT_PROVIDER || undefined,
    defaultModel: process.env.TRANSLATE_DEFAULT_MODEL || undefined,
    timeoutSec: process.env.TRANSLATE_TIMEOUT_SEC
      ? parseInt(process.env.TRANSLATE_TIMEOUT_SEC, 10)
      : undefined,
    maxTextLength: process.env.TRANSLATE_MAX_TEXT_LENGTH
      ? parseInt(process.env.TRANSLATE_MAX_TEXT_LENGTH, 10)
      : undefined,
    retryMaxAttempts: process.env.TRANSLATE_RETRY_MAX_ATTEMPTS
      ? parseInt(process.env.TRANSLATE_RETRY_MAX_ATTEMPTS, 10)
      : undefined,
    retryInitialDelayMs: process.env.TRANSLATE_RETRY_INITIAL_DELAY_MS
      ? parseInt(process.env.TRANSLATE_RETRY_INITIAL_DELAY_MS, 10)
      : undefined,
    retryMaxDelayMs: process.env.TRANSLATE_RETRY_MAX_DELAY_MS
      ? parseInt(process.env.TRANSLATE_RETRY_MAX_DELAY_MS, 10)
      : undefined,
  });

  const errors = validateSync(config, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const errorMessages = errors.map(err => Object.values(err.constraints ?? {}).join(', '));
    throw new Error(`Translate config validation error: ${errorMessages.join('; ')}`);
  }

  return config;
});
