import { plainToClass } from 'class-transformer';
import { IsIn, IsInt, IsString, Max, Min, MinLength, validateSync } from 'class-validator';
import { registerAs } from '@nestjs/config';

/**
 * Application configuration schema.
 * Defines the structure and validation rules for the application's core settings.
 */
export class AppConfig {
  /**
   * The port number on which the server will listen.
   * Defined by LISTEN_PORT environment variable.
   * Default: 8080
   */
  @IsInt()
  @Min(1)
  @Max(65535)
  public port!: number;

  /**
   * The host address to verify binding.
   * Defined by LISTEN_HOST environment variable.
   * Default: 0.0.0.0
   */
  @IsString()
  public host!: string;

  /**
   * global prefix for all API routes.
   * Defined by SERVER_BASE_PATH environment variable.
   * Default: empty string (or api/v1 handling in main.ts)
   */
  @IsString()
  public basePath!: string;

  /**
   * The node environment mode.
   * Defined by NODE_ENV environment variable.
   * Values: 'development', 'production', 'test'
   * Default: 'production'
   */
  @IsIn(['development', 'production', 'test'])
  public nodeEnv!: string;

  /**
   * Logging level for the application.
   * Defined by LOG_LEVEL environment variable.
   * Values correspond to Pino log levels.
   * Default: 'warn'
   */
  @IsIn(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
  public logLevel!: string;

  /**
   * Telegram ID of the super administrator.
   * Users with this ID will automatically be granted administrative privileges.
   * Defined by TELEGRAM_ADMIN_ID environment variable.
   */
  @IsString()
  public adminTelegramId!: string;

  /**
   * Telegram Bot Token.
   */
  @IsString()
  public telegramBotToken!: string;

  /**
   * JWT Secret for auth.
   */
  @IsString()
  @MinLength(32, {
    message:
      'JWT_SECRET must be at least 32 characters long for security reasons (AES-256 requirement)',
  })
  public jwtSecret!: string;

  /**
   * Media configuration.
   */
  public media!: {
    /**
     * Maximum file size for uploads in bytes.
     * Default: 52428800 (50MB)
     */
    maxFileSize: number;
  };

  /**
   * Timeout for graceful shutdown in milliseconds.
   * Defined by SHUTDOWN_TIMEOUT_MS environment variable.
   * Default: 30000
   */
  @IsInt()
  @Min(1000)
  public shutdownTimeoutMs!: number;
}

export default registerAs('app', (): AppConfig => {
  // Transform environment variables to a typed configuration object
  const config = plainToClass(AppConfig, {
    port: parseInt(process.env.LISTEN_PORT ?? '8080', 10),
    host: process.env.LISTEN_HOST ?? '0.0.0.0',
    basePath: (process.env.SERVER_BASE_PATH ?? '').replace(/^\/+|\/+$/g, ''),
    nodeEnv: process.env.NODE_ENV ?? 'production',
    logLevel: process.env.LOG_LEVEL ?? 'warn',

    adminTelegramId: process.env.TELEGRAM_ADMIN_ID,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    jwtSecret: process.env.JWT_SECRET,

    // Media Config
    media: {
      maxFileSize: parseInt(process.env.MEDIA_MAX_FILE_SIZE ?? '52428800', 10),
    },

    // Shutdown Config
    shutdownTimeoutMs: parseInt(process.env.SHUTDOWN_TIMEOUT_MS ?? '30000', 10),
  });

  // Perform synchronous validation of the configuration object
  const errors = validateSync(config, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const errorMessages = errors.map(err => Object.values(err.constraints ?? {}).join(', '));
    throw new Error(`App config validation error: ${errorMessages.join('; ')}`);
  }

  return config;
});
