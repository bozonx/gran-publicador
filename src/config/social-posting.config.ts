import { plainToClass } from 'class-transformer';
import { IsInt, Min, validateSync } from 'class-validator';
import { registerAs } from '@nestjs/config';

/**
 * Configuration for bozonx-social-media-posting library.
 */
export class SocialPostingConfig {
  /**
   * Request timeout in seconds.
   * Defined by SOCIAL_POSTING_REQUEST_TIMEOUT_SECS environment variable.
   * Default: 60
   */
  @IsInt()
  @Min(1)
  public requestTimeoutSecs!: number;

  /**
   * Number of retry attempts on error.
   * Defined by SOCIAL_POSTING_RETRY_ATTEMPTS environment variable.
   * Default: 3
   */
  @IsInt()
  @Min(0)
  public retryAttempts!: number;

  /**
   * Delay between retry attempts in milliseconds.
   * Defined by SOCIAL_POSTING_RETRY_DELAY_MS environment variable.
   * Default: 1000
   */
  @IsInt()
  @Min(0)
  public retryDelayMs!: number;

  /**
   * Time-to-live for idempotency records in cache in minutes.
   * Defined by SOCIAL_POSTING_IDEMPOTENCY_TTL_MINUTES environment variable.
   * Default: 10
   */
  @IsInt()
  @Min(1)
  public idempotencyTtlMinutes!: number;
}

export default registerAs('socialPosting', (): SocialPostingConfig => {
  const config = plainToClass(SocialPostingConfig, {
    requestTimeoutSecs: parseInt(process.env.SOCIAL_POSTING_REQUEST_TIMEOUT_SECS ?? '60', 10),
    retryAttempts: parseInt(process.env.SOCIAL_POSTING_RETRY_ATTEMPTS ?? '3', 10),
    retryDelayMs: parseInt(process.env.SOCIAL_POSTING_RETRY_DELAY_MS ?? '1000', 10),
    idempotencyTtlMinutes: parseInt(process.env.SOCIAL_POSTING_IDEMPOTENCY_TTL_MINUTES ?? '10', 10),
  });

  const errors = validateSync(config, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const errorMessages = errors.map(err => Object.values(err.constraints ?? {}).join(', '));
    throw new Error(`Social posting config validation error: ${errorMessages.join('; ')}`);
  }

  return config;
});
