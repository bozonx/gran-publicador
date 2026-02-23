import { plainToClass } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { registerAs } from '@nestjs/config';
import { readFileSync } from 'fs';
import { join } from 'path';

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
  @IsOptional()
  @IsString()
  public adminTelegramId?: string;

  /**
   * Telegram Bot Token.
   */
  @ValidateIf(o => o.telegramBotEnabled)
  @IsString()
  public telegramBotToken?: string;

  /**
   * Whether the Telegram bot for repost collection is enabled.
   */
  @IsBoolean()
  public telegramBotEnabled!: boolean;

  /**
   * Frontend URL for publication links in bot messages.
   * Defined by FRONTEND_URL environment variable.
   */
  @IsString()
  public frontendUrl!: string;

  /**
   * Base URL for Telegram Mini App.
   * Defined by TELEGRAM_MINI_APP_URL environment variable.
   */
  @IsOptional()
  @IsString()
  public telegramMiniAppUrl?: string;

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
   * Secret for system API (e.g., from n8n).
   * Defined by SYSTEM_API_SECRET environment variable.
   */
  @IsString()
  @IsOptional()
  public systemApiSecret?: string;

  /**
   * Whether to restrict system API to local network IPs.
   * Defined by SYSTEM_API_IP_RESTRICTION_ENABLED environment variable.
   * Default: true
   */
  public systemApiIpRestrictionEnabled: boolean = true;

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
   * Timeout for graceful shutdown in seconds.
   * Defined by SHUTDOWN_TIMEOUT_SECONDS environment variable.
   * Default: 30
   */
  @IsInt()
  @Min(1)
  public shutdownTimeoutSeconds!: number;

  /**
   * Scheduler window for publications in minutes.
   * Defined by SCHEDULER_WINDOW_MINUTES environment variable.
   * Default: 10
   */
  @IsInt()
  @Min(1)
  public schedulerWindowMinutes!: number;

  /**
   * Timezone for the application.
   * Defined by TZ environment variable.
   * Default: 'UTC'
   */
  @IsString()
  public timezone!: string;

  /**
   * Version of the application from package.json.
   */
  @IsString()
  public version!: string;
}

export default registerAs('app', (): AppConfig => {
  // Try to load version from package.json
  let version = 'unknown';
  try {
    const pkgPath = join(process.cwd(), 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    version = pkg.version;
  } catch (e) {
    version = process.env.npm_package_version || 'unknown';
  }

  // Transform environment variables to a typed configuration object
  const config = plainToClass(AppConfig, {
    port: parseInt(process.env.PORT ?? process.env.LISTEN_PORT ?? '8080', 10),
    host: process.env.LISTEN_HOST ?? '0.0.0.0',
    basePath: (process.env.SERVER_BASE_PATH ?? '').replace(/^\/+|\/+$/g, ''),
    nodeEnv: process.env.NODE_ENV ?? 'production',
    logLevel: process.env.LOG_LEVEL ?? 'warn',

    adminTelegramId: process.env.TELEGRAM_ADMIN_ID || undefined,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || undefined,
    telegramBotEnabled: process.env.TELEGRAM_BOT_ENABLED === 'true',
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    telegramMiniAppUrl:
      process.env.TELEGRAM_MINI_APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000',
    jwtSecret: process.env.JWT_SECRET,
    systemApiSecret: process.env.SYSTEM_API_SECRET,
    systemApiIpRestrictionEnabled: process.env.SYSTEM_API_IP_RESTRICTION_ENABLED !== 'false',

    // Media Config
    media: {
      maxFileSize: parseInt(process.env.MEDIA_MAX_FILE_SIZE ?? '52428800', 10),
    },

    // Shutdown Config
    shutdownTimeoutSeconds: parseInt(process.env.SHUTDOWN_TIMEOUT_SECONDS ?? '30', 10),

    // Scheduler Config
    schedulerWindowMinutes: parseInt(process.env.SCHEDULER_WINDOW_MINUTES ?? '10', 10),
    timezone: process.env.TZ ?? 'UTC',
    version,
  });

  return config;
});
