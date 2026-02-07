import { plainToClass } from 'class-transformer';
import { IsInt, Min, IsString, IsOptional, Max, IsUrl } from 'class-validator';
import { registerAs } from '@nestjs/config';

/**
 * Configuration for Media Storage microservice integration.
 */
export class MediaConfig {
  /**
   * URL of the Media Storage microservice.
   */
  @IsString()
  @IsOptional() // Optional so app can start without it, but validated if present
  @IsUrl({ require_tld: false })
  public serviceUrl?: string;

  /**
   * Application ID used to group files.
   */
  @IsString()
  @IsOptional()
  public appId: string = 'gran-publicador';

  /**
   * API Token for Bearer authorization (optional).
   */
  @IsString()
  @IsOptional()
  public apiToken?: string;

  /**
   * Request timeout in seconds.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  public timeoutSecs: number = 60;

  /**
   * Maximum allowed file size in MB.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  public maxFileSizeMb: number = 100;

  /**
   * Optional thumbnail quality setting.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  public thumbnailQuality?: number;
}

export default registerAs('media', (): MediaConfig => {
  const rawConfig: any = {
    serviceUrl: process.env.MEDIA_STORAGE_SERVICE_URL,
    appId: process.env.MEDIA_STORAGE_APP_ID,
    apiToken: process.env.MEDIA_STORAGE_API_TOKEN,
    timeoutSecs: process.env.MEDIA_STORAGE_TIMEOUT_SECS
      ? parseInt(process.env.MEDIA_STORAGE_TIMEOUT_SECS, 10)
      : undefined,
    maxFileSizeMb: process.env.MEDIA_STORAGE_MAX_FILE_SIZE_MB
      ? parseInt(process.env.MEDIA_STORAGE_MAX_FILE_SIZE_MB, 10)
      : undefined,
    thumbnailQuality: process.env.THUMBNAIL_QUALITY
      ? parseInt(process.env.THUMBNAIL_QUALITY, 10)
      : undefined,
  };

  // Remove undefined and NaN values to let class defaults take over
  Object.keys(rawConfig).forEach(key => {
    const value = rawConfig[key];
    if (value === undefined || (typeof value === 'number' && isNaN(value))) {
      delete rawConfig[key];
    }
  });

  const config = plainToClass(MediaConfig, rawConfig);

  return config;
});
