import { plainToClass } from 'class-transformer';
import { IsInt, Min, IsString, IsUrl, IsOptional } from 'class-validator';
import { registerAs } from '@nestjs/config';

/**
 * Configuration for Speech-To-Text (STT) microservice integration.
 */
export class SttConfig {
  /**
   * URL of the STT microservice.
   * Defined by STT_SERVICE_URL environment variable.
   * Example: http://localhost:8081/api/v1
   */
  @IsString()
  @IsOptional()
  @IsUrl({ require_tld: false })
  public serviceUrl?: string;

  /**
   * Request timeout in milliseconds.
   * Defined by STT_TIMEOUT_MS environment variable.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  public timeoutMs?: number = 300000;

  /**
   * Maximum allowed audio file size in bytes.
   * Defined by STT_MAX_FILE_SIZE environment variable.
   * Default: 10MB
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  public maxFileSize?: number = 10 * 1024 * 1024;
}

export default registerAs('stt', (): SttConfig => {
  const rawConfig: any = {
    serviceUrl: process.env.STT_SERVICE_URL,
    timeoutMs: process.env.STT_TIMEOUT_MS ? parseInt(process.env.STT_TIMEOUT_MS, 10) : undefined,
    maxFileSize: process.env.STT_MAX_FILE_SIZE
      ? parseInt(process.env.STT_MAX_FILE_SIZE, 10)
      : undefined,
  };

  // Remove undefined and NaN values to let class defaults take over
  Object.keys(rawConfig).forEach(key => {
    const value = rawConfig[key];
    if (value === undefined || (typeof value === 'number' && isNaN(value))) {
      delete rawConfig[key];
    }
  });

  const config = plainToClass(SttConfig, rawConfig);

  return config;
});
