import { ClassSerializerInterceptor, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { AcceptLanguageResolver, HeaderResolver, I18nModule, QueryResolver } from 'nestjs-i18n';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
void __filename;

import pkg from '../package.json' with { type: 'json' };
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { PermissionsModule } from './common/services/permissions.module.js';
import appConfig, { AppConfig } from './config/app.config.js';
import socialPostingConfig from './config/social-posting.config.js';
import llmConfig from './config/llm.config.js';
import sttConfig from './config/stt.config.js';
import translateConfig from './config/translate.config.js';
import newsConfig from './config/news.config.js';
import unsplashConfig from './config/unsplash.config.js';
import redisConfig, { RedisConfig } from './config/redis.config.js';
import mediaConfig, { MediaConfig } from './config/media.config.js';
import httpConfig from './config/http.config.js';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { BullModule } from '@nestjs/bullmq';
import { RedisModule } from './common/redis/redis.module.js';
import { ApiTokensModule } from './modules/api-tokens/api-tokens.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ChannelsModule } from './modules/channels/channels.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { PostsModule } from './modules/posts/posts.module.js';
import { PrismaModule } from './modules/prisma/prisma.module.js';
import { ProjectsModule } from './modules/projects/projects.module.js';
import { PublicationsModule } from './modules/publications/publications.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { ArchiveModule } from './modules/archive/archive.module.js';
import { MediaModule } from './modules/media/media.module.js';
import { ShutdownModule } from './common/services/shutdown.module.js';
import { LlmModule } from './modules/llm/llm.module.js';
import { SttModule } from './modules/stt/stt.module.js';
import { TranslateModule } from './modules/translate/translate.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { LlmPromptTemplatesModule } from './modules/llm-prompt-templates/llm-prompt-templates.module.js';
import { TelegramBotModule } from './modules/telegram-bot/index.js';
import { AuthorSignaturesModule } from './modules/author-signatures/author-signatures.module.js';
import { RolesModule } from './modules/roles/roles.module.js';
import { NewsQueriesModule } from './modules/news-queries/news-queries.module.js';
import { SourcesModule } from './modules/sources/sources.module.js';
import { SystemModule } from './modules/system/system.module.js';
import { ContentLibraryModule } from './modules/content-library/content-library.module.js';
import { PublicationRelationsModule } from './modules/publication-relations/publication-relations.module.js';
import { ProjectTemplatesModule } from './modules/project-templates/project-templates.module.js';
import { TagsModule } from './modules/tags/tags.module.js';
import { PinoLogger } from 'nestjs-pino';
import { GuardsModule } from './common/guards/guards.module.js';

function validateEnvironment(config: Record<string, unknown>): Record<string, unknown> {
  const databaseUrl = config.DATABASE_URL;
  if (!databaseUrl || typeof databaseUrl !== 'string') {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const jwtSecret = config.JWT_SECRET;
  if (!jwtSecret || typeof jwtSecret !== 'string' || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be set and be at least 32 characters long');
  }

  const socialPostingUrl = config.SOCIAL_POSTING_SERVICE_URL;
  if (!socialPostingUrl || typeof socialPostingUrl !== 'string') {
    throw new Error('SOCIAL_POSTING_SERVICE_URL environment variable is not set');
  }

  // Redis is required in all non-test environments.
  if ((config.NODE_ENV ?? 'development') !== 'test') {
    const redisUrl = config.REDIS_URL || config.REDIS_HOST;
    if (!redisUrl || typeof redisUrl !== 'string') {
      throw new Error('Either REDIS_URL or REDIS_HOST environment variable must be set');
    }
  }

  const telegramBotEnabled = config.TELEGRAM_BOT_ENABLED;
  if (telegramBotEnabled === 'true') {
    const telegramBotToken = config.TELEGRAM_BOT_TOKEN;
    if (!telegramBotToken || typeof telegramBotToken !== 'string') {
      throw new Error('TELEGRAM_BOT_TOKEN is required when TELEGRAM_BOT_ENABLED is true');
    }
  }

  return config;
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
      load: [
        appConfig,
        socialPostingConfig,
        llmConfig,
        sttConfig,
        translateConfig,
        newsConfig,
        unsplashConfig,
        redisConfig,
        mediaConfig,
        httpConfig,
      ],
      envFilePath: [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
      cache: true,
    }),
    I18nModule.forRoot({
      fallbackLanguage: 'en-US',
      fallbacks: {
        'en-*': 'en-US',
        'ru-*': 'ru-RU',
      },
      loaderOptions: {
        path: join(
          process.cwd(),
          process.env.NODE_ENV === 'production' ? 'dist/src/i18n' : 'src/i18n',
        ),
        watch: process.env.NODE_ENV !== 'production',
      },
      resolvers: [
        { use: QueryResolver, options: ['lang'] },
        AcceptLanguageResolver,
        new HeaderResolver(['x-custom-lang']),
      ],
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const appConfig = configService.get<AppConfig>('app')!;
        const isDev = appConfig.nodeEnv === 'development';

        return {
          pinoHttp: {
            level: appConfig.logLevel,
            timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
            base: {
              service: (pkg as any).name ?? 'app',
              environment: appConfig.nodeEnv,
            },
            // Use pino-pretty for better readability in development
            transport: isDev
              ? {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    singleLine: false,
                    translateTime: "UTC:yyyy-mm-dd'T'HH:MM:ss.l'Z'",
                    ignore: 'pid,hostname',
                    messageFormat: '[{context}] {msg}',
                  },
                }
              : undefined,
            serializers: {
              req: req => ({
                id: req.id,
                method: req.method,
                url: req.url,
                path: req.url?.split('?')[0],
                remoteAddress: req.ip,
                remotePort: req.socket?.remotePort,
              }),
              res: res => ({
                statusCode: res.statusCode,
              }),
              err: err => ({
                type: err.type,
                message: err.message,
                stack: err.stack,
              }),
            },
            // Redact sensitive headers to prevent leakage in logs
            redact: {
              paths: ['req.headers.authorization', 'req.headers["x-api-key"]'],
              censor: '[REDACTED]',
            },
            // Custom log level mapping based on response status code
            customLogLevel: (req, res, err) => {
              if (res.statusCode >= 500 || err) {
                return 'error';
              }
              if (res.statusCode >= 400) {
                return 'warn';
              }
              if (res.statusCode >= 300) {
                return 'info';
              }
              return 'info';
            },
            autoLogging: {
              // Ignore health checks in production to reduce log noise
              ignore: req => {
                if (appConfig.nodeEnv === 'production') {
                  return req.url?.includes('/health') ?? false;
                }
                return false;
              },
            },
          },
        };
      },
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService, PinoLogger],
      useFactory: async (configService: ConfigService, logger: PinoLogger) => {
        const config = configService.get<RedisConfig>('redis')!;
        const appConfig = configService.get<AppConfig>('app')!;

        const isUpstash = config.url.includes('upstash.io');
        const socketOptions: any = { connectTimeout: 5000 };
        if (isUpstash) {
          socketOptions.family = 0;
        }

        const store = await redisStore({
          url: config.url,
          socket: socketOptions,
          ttl: config.ttlMs,
          keyPrefix: config.keyPrefix,
        } as any);

        return {
          store,
        };
      },
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const config = configService.get<RedisConfig>('redis')!;

        const isUpstash = config.url.includes('upstash.io');
        const redisOptions: any = {
          maxRetriesPerRequest: null, // BullMQ requires maxRetriesPerRequest to be null
        };

        if (isUpstash) {
          redisOptions.family = 0;
        }

        return {
          connection: {
            url: config.url,
            ...redisOptions,
          },
          prefix: config.keyPrefix,
        };
      },
    }),
    GuardsModule,
    RedisModule,
    ShutdownModule,
    HealthModule,
    PrismaModule,
    PermissionsModule,
    UsersModule,
    AuthModule,
    ProjectsModule,
    ChannelsModule,
    PostsModule,
    PublicationsModule,
    ApiTokensModule,
    ArchiveModule,
    MediaModule,
    LlmModule,
    SttModule,
    TranslateModule,
    NotificationsModule,
    LlmPromptTemplatesModule,
    AuthorSignaturesModule,
    RolesModule,
    NewsQueriesModule,
    SourcesModule,
    SystemModule,
    ContentLibraryModule,
    PublicationRelationsModule,
    ProjectTemplatesModule,
    TagsModule,
    ...(process.env.TELEGRAM_BOT_ENABLED === 'true' ? [TelegramBotModule] : []),
  ],
  controllers: [],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ClassSerializerInterceptor,
    },
  ],
})
/**
 * The root module of the application.
 * Configures global imports, providers, and modules.
 */
export class AppModule {}
