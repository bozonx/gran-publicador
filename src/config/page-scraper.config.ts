import { plainToClass } from 'class-transformer';
import { IsString, IsUrl, validateSync } from 'class-validator';
import { registerAs } from '@nestjs/config';

/**
 * Configuration for Page Scraper microservice integration.
 */
export class PageScraperConfig {
  /**
   * URL of the Page Scraper microservice.
   * Defined by PAGE_SCRAPER_URL environment variable.
   * Example: http://localhost:8080
   */
  @IsString()
  @IsUrl({ require_tld: false })
  public serviceUrl!: string;
}

export default registerAs('pageScraper', (): PageScraperConfig => {
  const rawConfig: any = {
    serviceUrl: process.env.PAGE_SCRAPER_URL || 'http://page-scraper:8080',
  };

  const config = plainToClass(PageScraperConfig, rawConfig);

  const errors = validateSync(config, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const errorMessages = errors.map(err => Object.values(err.constraints ?? {}).join(', '));
    throw new Error(`Page Scraper config validation error: ${errorMessages.join('; ')}`);
  }

  return config;
});
