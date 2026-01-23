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
}

export default registerAs('news', (): NewsConfig => {
  const rawConfig: any = {
    serviceUrl: process.env.NEWS_SERVICE_URL || 'http://news-microservice:8088',
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
