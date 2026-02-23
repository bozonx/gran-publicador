import { plainToClass } from 'class-transformer';
import { IsInt, Min, IsString, IsUrl, IsOptional } from 'class-validator';
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
   * Single request timeout in seconds.
   * Defined by SOCIAL_POSTING_SERVICE_REQUEST_TIMEOUT_SECS environment variable.
   * Default: 30
   */
  @IsInt()
  @Min(1)
  public serviceRequestTimeoutSecs!: number;

  /**
   * Time-to-live for idempotency records in cache in minutes.
   * Defined by SOCIAL_POSTING_IDEMPOTENCY_TTL_MINUTES environment variable.
   * Default: 10
   */
  @IsInt()
  @Min(1)
  public idempotencyTtlMinutes!: number;

  /**
   * URL of the social media posting microservice.
   * Defined by SOCIAL_POSTING_SERVICE_URL environment variable.
   * Example: http://localhost:8080/api/v1
   */
  @IsString()
  @IsUrl({ require_tld: false })
  public serviceUrl!: string;

  /**
   * API Token for Bearer authorization (optional).
   */
  @IsOptional()
  @IsString()
  public apiToken?: string;
}

export default registerAs('socialPosting', (): SocialPostingConfig => {
  const config = plainToClass(SocialPostingConfig, {
    requestTimeoutSecs: parseInt(process.env.SOCIAL_POSTING_REQUEST_TIMEOUT_SECS ?? '60', 10),
    serviceRequestTimeoutSecs: parseInt(
      process.env.SOCIAL_POSTING_SERVICE_REQUEST_TIMEOUT_SECS ?? '30',
      10,
    ),
    idempotencyTtlMinutes: parseInt(process.env.SOCIAL_POSTING_IDEMPOTENCY_TTL_MINUTES ?? '10', 10),
    serviceUrl: process.env.SOCIAL_POSTING_SERVICE_URL,
    apiToken: process.env.SOCIAL_POSTING_SERVICE_API_TOKEN,
  });

  return config;
});
