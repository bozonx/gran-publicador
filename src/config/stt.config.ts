import { plainToClass } from 'class-transformer';
import { IsInt, Min, IsString, IsUrl, IsOptional, IsBoolean } from 'class-validator';
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
   * API Token for Bearer authorization (optional).
   */
  @IsString()
  @IsOptional()
  public apiToken?: string;

  /**
   * Request timeout in milliseconds.
   * Defined by STT_TIMEOUT_MS environment variable.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  public timeoutMs?: number = 600000;

  /**
   * Maximum allowed audio file size in bytes.
   * Defined by STT_MAX_FILE_SIZE environment variable.
   * Default: 50MB
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  public maxFileSize?: number = 50 * 1024 * 1024;

  @IsOptional()
  @IsString()
  public defaultProvider?: string;

  @IsOptional()
  @IsString()
  public defaultModels?: string;

  @IsOptional()
  @IsBoolean()
  public sendUserLanguage?: boolean = true;

  @IsOptional()
  @IsBoolean()
  public restorePunctuation?: boolean;

  @IsOptional()
  @IsBoolean()
  public formatText?: boolean;
}

export default registerAs('stt', (): SttConfig => {
  const rawConfig: any = {
    serviceUrl: process.env.STT_SERVICE_URL,
    apiToken: process.env.STT_SERVICE_API_TOKEN,
    timeoutMs: process.env.STT_TIMEOUT_MS ? parseInt(process.env.STT_TIMEOUT_MS, 10) : undefined,
    maxFileSize: process.env.STT_MAX_FILE_SIZE
      ? parseInt(process.env.STT_MAX_FILE_SIZE, 10)
      : undefined,
    defaultProvider: process.env.STT_DEFAULT_PROVIDER,
    defaultModels: process.env.STT_DEFAULT_MODELS,
    sendUserLanguage:
      process.env.STT_SEND_USER_LANGUAGE !== undefined
        ? process.env.STT_SEND_USER_LANGUAGE === 'true'
        : undefined,
    restorePunctuation:
      process.env.STT_RESTORE_PUNCTUATION !== undefined
        ? process.env.STT_RESTORE_PUNCTUATION === 'true'
        : undefined,
    formatText:
      process.env.STT_FORMAT_TEXT !== undefined
        ? process.env.STT_FORMAT_TEXT === 'true'
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
