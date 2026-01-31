import { plainToClass } from 'class-transformer';
import { IsString, IsUrl, IsOptional, validateSync } from 'class-validator';
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
   * Interval in minutes for checking news notifications.
   * Defined by NEWS_NOTIFICATION_INTERVAL_MINUTES environment variable.
   * Default: 10
   */
  @IsOptional()
  public notificationIntervalMinutes: number = 10;

  /**
   * Maximum lookback window in hours for news scheduler.
   * Defined by NEWS_SCHEDULER_LOOKBACK_HOURS environment variable.
   * Default: 3
   */
  @IsOptional()
  public schedulerLookbackHours: number = 3;
}

export default registerAs('news', (): NewsConfig => {
  const rawConfig: any = {
    serviceUrl: process.env.NEWS_SERVICE_URL || 'http://news-microservice:8088',
    notificationIntervalMinutes: process.env.NEWS_NOTIFICATION_INTERVAL_MINUTES 
      ? parseInt(process.env.NEWS_NOTIFICATION_INTERVAL_MINUTES, 10) 
      : 10,
    schedulerLookbackHours: process.env.NEWS_SCHEDULER_LOOKBACK_HOURS
      ? parseInt(process.env.NEWS_SCHEDULER_LOOKBACK_HOURS, 10)
      : 3,
  };

  const config = plainToClass(NewsConfig, rawConfig);

  const errors = validateSync(config, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const errorMessages = errors.map(err => Object.values(err.constraints ?? {}).join(', '));
    throw new Error(`News config validation error: ${errorMessages.join('; ')}`);
  }

  return config;
});
