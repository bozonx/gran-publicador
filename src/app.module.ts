import { ClassSerializerInterceptor, Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { AcceptLanguageResolver, HeaderResolver, I18nModule, QueryResolver } from 'nestjs-i18n';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import pkg from '../package.json' with { type: 'json' };
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { PermissionsModule } from './common/services/permissions.module.js';
import appConfig, { AppConfig } from './config/app.config.js';
import socialPostingConfig from './config/social-posting.config.js';
import llmConfig from './config/llm.config.js';
import sttConfig from './config/stt.config.js';
import translateConfig from './config/translate.config.js';
import newsConfig from './config/news.config.js';
import redisConfig, { RedisConfig } from './config/redis.config.js';
import mediaConfig, { MediaConfig } from './config/media.config.js';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { RedisModule } from './common/redis/redis.module.js';
import { ApiTokensModule } from './modules/api-tokens/api-tokens.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ChannelsModule } from './modules/channels/channels.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { PostsModule } from './modules/posts/posts.module.js';
import { PrismaModule } from './modules/prisma/prisma.module.js';
import { ScheduleModule } from '@nestjs/schedule';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, socialPostingConfig, llmConfig, sttConfig, translateConfig, newsConfig, redisConfig, mediaConfig],
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
        watch: true,
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
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const config = configService.get<RedisConfig>('redis')!;
        const appConfig = configService.get<AppConfig>('app')!;

        // Use memory store for tests or if Redis is disabled to avoid dependency
        if (appConfig.nodeEnv === 'test' || !config.enabled) {
          return {
            store: 'memory',
            ttl: config.ttlMs,
          };
        }

        try {
          const store = await redisStore({
            socket: {
              host: config.host,
              port: config.port,
              connectTimeout: 2000, // Fail fast if redis is down
            },
            password: config.password,
            database: config.db,
            ttl: config.ttlMs,
          });

          return {
            store,
          };
        } catch (error: any) {
          console.warn(`Redis connection failed: ${error.message}. Falling back to memory store.`);
          return {
            store: 'memory',
            ttl: config.ttlMs,
          };
        }
      },
    }),
    RedisModule,
    ScheduleModule.forRoot(),
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
