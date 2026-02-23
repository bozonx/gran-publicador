import { plainToClass } from 'class-transformer';
import { IsString, IsUrl, IsOptional } from 'class-validator';
import { registerAs } from '@nestjs/config';

/**
 * Configuration for News microservice integration.
 */
export class NewsConfig {
  /**
   * URL of the News microservice.
   * Defined by NEWS_SERVICE_URL environment variable.
   * Example: http://localhost:8088
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

  /**
   * Single request timeout in seconds.
   * Defined by NEWS_REQUEST_TIMEOUT_SECS environment variable.
   * Default: 30
   */
  @IsOptional()
  public requestTimeoutSecs: number = 30;

  /**
   * Maximum lookback window in hours for news scheduler.
   * Defined by NEWS_SCHEDULER_LOOKBACK_HOURS environment variable.
   * Default: 3
   */
  @IsOptional()
  public schedulerLookbackHours: number = 3;

  /**
   * Maximum number of news items to fetch in a single scheduler run.
   * Defined by NEWS_SCHEDULER_FETCH_LIMIT environment variable.
   * Default: 100
   */
  @IsOptional()
  public schedulerFetchLimit: number = 100;

  /**
   * Default fingerprint for news refresh (JSON string).
   */
  @IsOptional()
  @IsString()
  public refreshFingerprint?: string;

  /**
   * Default mode for news refresh (e.g. 'extractor', 'playwright').
   */
  @IsOptional()
  @IsString()
  public refreshMode?: string;
}

export default registerAs('news', (): NewsConfig => {
  const rawConfig: any = {
    serviceUrl: process.env.NEWS_SERVICE_URL || 'http://news-microservice:8088',
    apiToken: process.env.NEWS_SERVICE_API_TOKEN,
    requestTimeoutSecs: process.env.NEWS_REQUEST_TIMEOUT_SECS
      ? parseInt(process.env.NEWS_REQUEST_TIMEOUT_SECS, 10)
      : 30,
    schedulerLookbackHours: process.env.NEWS_SCHEDULER_LOOKBACK_HOURS
      ? parseInt(process.env.NEWS_SCHEDULER_LOOKBACK_HOURS, 10)
      : 3,
    schedulerFetchLimit: process.env.NEWS_SCHEDULER_FETCH_LIMIT
      ? parseInt(process.env.NEWS_SCHEDULER_FETCH_LIMIT, 10)
      : 100,
    refreshFingerprint: process.env.NEWS_REFRESH_FINGERPRINT,
    refreshMode: process.env.NEWS_REFRESH_MODE,
  };

  const config = plainToClass(NewsConfig, rawConfig);

  return config;
});
