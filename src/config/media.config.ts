import { plainToClass } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, Min, IsString, IsOptional, Max, IsUrl } from 'class-validator';
import { registerAs } from '@nestjs/config';

type MediaImageOptimizationFormat = 'webp' | 'avif';
type MediaImageOptimizationChromaSubsampling = '4:2:0' | '4:4:4';

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

  /**
   * Global switch for image optimization in Media Storage requests.
   */
  @IsBoolean()
  public imageOptimizationEnabled: boolean = true;

  /**
   * Forced output format for optimized images.
   */
  @IsIn(['webp', 'avif'])
  public imageOptimizationFormat: MediaImageOptimizationFormat = 'webp';

  /**
   * Forced max dimension for optimized images.
   */
  @IsInt()
  @Min(1)
  public imageOptimizationMaxDimension: number = 3840;

  /**
   * Forced encoding effort for optimized images.
   */
  @IsInt()
  @Min(0)
  @Max(9)
  public imageOptimizationEffort: number = 4;

  /**
   * Forced compression quality for optimized images.
   */
  @IsInt()
  @Min(1)
  @Max(100)
  public imageOptimizationQuality: number = 80;

  /**
   * Forced chroma subsampling for optimized images.
   */
  @IsIn(['4:2:0', '4:4:4'])
  public imageOptimizationChromaSubsampling: MediaImageOptimizationChromaSubsampling = '4:2:0';

  /**
   * Forced lossless mode for optimized images.
   */
  @IsBoolean()
  public imageOptimizationLossless: boolean = false;

  /**
   * Strip metadata from optimized images.
   */
  @IsBoolean()
  public imageOptimizationStripMetadata: boolean = true;

  /**
   * Auto-orient image based on EXIF.
   */
  @IsBoolean()
  public imageOptimizationAutoOrient: boolean = false;

  /**
   * Flatten alpha layer onto a white background.
   */
  @IsBoolean()
  public imageOptimizationFlatten: boolean = true;
}

export default registerAs('media', (): MediaConfig => {
  const parseBoolean = (value: string | undefined): boolean | undefined => {
    if (!value) return undefined;

    const normalized = value.trim().toLowerCase();
    if (
      normalized === 'true' ||
      normalized === '1' ||
      normalized === 'yes' ||
      normalized === 'on'
    ) {
      return true;
    }

    if (
      normalized === 'false' ||
      normalized === '0' ||
      normalized === 'no' ||
      normalized === 'off'
    ) {
      return false;
    }

    return undefined;
  };

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
    imageOptimizationEnabled: parseBoolean(process.env.MEDIA_IMAGE_OPTIMIZATION_ENABLED),
    imageOptimizationFormat: process.env.MEDIA_IMAGE_OPTIMIZATION_FORMAT?.toLowerCase(),
    imageOptimizationMaxDimension: process.env.MEDIA_IMAGE_OPTIMIZATION_MAX_DIMENSION
      ? parseInt(process.env.MEDIA_IMAGE_OPTIMIZATION_MAX_DIMENSION, 10)
      : undefined,
    imageOptimizationEffort: process.env.MEDIA_IMAGE_OPTIMIZATION_EFFORT
      ? parseInt(process.env.MEDIA_IMAGE_OPTIMIZATION_EFFORT, 10)
      : undefined,
    imageOptimizationQuality: process.env.MEDIA_IMAGE_OPTIMIZATION_QUALITY
      ? parseInt(process.env.MEDIA_IMAGE_OPTIMIZATION_QUALITY, 10)
      : undefined,
    imageOptimizationChromaSubsampling: process.env.MEDIA_IMAGE_OPTIMIZATION_CHROMA_SUBSAMPLING,
    imageOptimizationLossless: parseBoolean(process.env.MEDIA_IMAGE_OPTIMIZATION_LOSSLESS),
    imageOptimizationStripMetadata: parseBoolean(
      process.env.MEDIA_IMAGE_OPTIMIZATION_STRIP_METADATA,
    ),
    imageOptimizationAutoOrient: parseBoolean(process.env.MEDIA_IMAGE_OPTIMIZATION_AUTO_ORIENT),
    imageOptimizationFlatten: parseBoolean(process.env.MEDIA_IMAGE_OPTIMIZATION_FLATTEN),
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
