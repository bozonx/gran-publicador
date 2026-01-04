import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';

import pkg from '../package.json' with { type: 'json' };
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { PermissionsModule } from './common/services/permissions.module.js';
import appConfig, { AppConfig } from './config/app.config.js';
import { ApiTokensModule } from './modules/api-tokens/api-tokens.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ChannelsModule } from './modules/channels/channels.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { PostsModule } from './modules/posts/posts.module.js';
import { PrismaModule } from './modules/prisma/prisma.module.js';
import { ProjectsModule } from './modules/projects/projects.module.js';
import { PublicationsModule } from './modules/publications/publications.module.js';
import { SystemConfigModule } from './modules/system-config/system-config.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { ArchiveModule } from './modules/archive/archive.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      envFilePath: [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
      cache: true,
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
    HealthModule,
    PrismaModule,
    PermissionsModule,
    UsersModule,
    AuthModule,
    ProjectsModule,
    ChannelsModule,
    PostsModule,
    PublicationsModule,
    SystemConfigModule,
    ApiTokensModule,
    ArchiveModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
/**
 * The root module of the application.
 * Configures global imports, providers, and modules.
 */
export class AppModule {}
