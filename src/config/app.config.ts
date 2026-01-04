import { plainToClass } from 'class-transformer';
import { IsIn, IsInt, IsString, Max, Min, MinLength, validateSync } from 'class-validator';
import { registerAs } from '@nestjs/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';

import { getDataDir } from './database.config.js';

/**
 * Application configuration schema.
 * Defines the structure and validation rules for the application's core settings.
 */
export class AppConfig {
  /**
   * The port number on which the server will listen.
   * Defined by SERVER_PORT environment variable.
   * Default: 8080
   */
  @IsInt()
  @Min(1)
  @Max(65535)
  public port!: number;

  /**
   * The host address to verify binding.
   * Defined by SERVER_HOST environment variable.
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
}

export default registerAs('app', (): AppConfig => {
  const dataDir = getDataDir();
  const configFileName = 'app-config.yaml';
  const defaultConfigFileName = 'app-config-default.yaml';

  const configPath = path.join(path.resolve(process.cwd(), dataDir), configFileName);
  const defaultPath = path.resolve(process.cwd(), defaultConfigFileName);

  let fileContent = '';

  // Ensure config file exists
  if (!fs.existsSync(configPath)) {
    if (fs.existsSync(defaultPath)) {
      fs.copyFileSync(defaultPath, configPath);
    }
  }

  // Read config file
  if (fs.existsSync(configPath)) {
    fileContent = fs.readFileSync(configPath, 'utf8');
  } else if (fs.existsSync(defaultPath)) {
    // Fallback if copy failed or something weird happened, use default directly
    fileContent = fs.readFileSync(defaultPath, 'utf8');
  }

  // Substitute environment variables
  const substitutedContent = fileContent.replace(
    /\${(\w+)(?::-([^}]*))?}/g,
    (_, varName, defaultValue) => {
      return process.env[varName] ?? defaultValue ?? '';
    },
  );

  // Parse YAML
  const fileConfig = (yaml.load(substitutedContent) as Record<string, any>) ?? {};

  // Transform environment variables and file config to a typed configuration object
  const config = plainToClass(AppConfig, {
    // System/Env config (Process Env has priority for these infrastructural settings)
    port: parseInt(process.env.SERVER_PORT ?? '8080', 10),
    host: process.env.SERVER_HOST ?? '0.0.0.0',
    basePath: (process.env.SERVER_BASE_PATH ?? '').replace(/^\/+|\/+$/g, ''),
    nodeEnv: process.env.NODE_ENV ?? 'production',
    logLevel: process.env.LOG_LEVEL ?? 'warn',

    // Application Config (File has priority, but fallback to env if missing in file is reasonable,
    // though here we assume file controls these values via placeholders)
    adminTelegramId: fileConfig.telegramAdminId?.toString() ?? process.env.TELEGRAM_ADMIN_ID,
    telegramBotToken: fileConfig.telegramBotToken ?? process.env.TELEGRAM_BOT_TOKEN,
    jwtSecret: fileConfig.jwtSecret ?? process.env.JWT_SECRET,
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
