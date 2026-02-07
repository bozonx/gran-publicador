import 'reflect-metadata';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyStatic from '@fastify/static';
import multipart from '@fastify/multipart';
import fastifyHelmet from '@fastify/helmet';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module.js';
import { SpaFallbackFilter } from './common/filters/spa-fallback.filter.js';
import { BigIntInterceptor } from './common/interceptors/bigint.interceptor.js';
import type { AppConfig } from './config/app.config.js';

/**
 * Validate that DATABASE_URL is set before starting the application.
 * This is a REQUIRED environment variable for database configuration.
 */
if (!process.env.DATABASE_URL) {
  console.error('❌ FATAL ERROR: DATABASE_URL environment variable is not set!');
  console.error(
    '   DATABASE_URL must be a valid connection string (e.g., postgresql://user:password@localhost:5432/gran_db?schema=public)',
  );
  process.exit(1);
}

/**
 * Bootstrap the NestJS application.
 * Initializes the Fastify adapter, global pipes, configuration, and starts the server.
 */
async function bootstrap() {
  // Create the app with the Fastify adapter.
  // We enable bufferLogs to ensure that no logs are lost during the initialization phase
  // before the custom logger is fully attached.
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: false, // Disable Fastify's default logger in favor of NestJS/Pino logger
      trustProxy: true,
    }),
    {
      bufferLogs: true,
      cors: {
        origin: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        credentials: true,
      },
    },
  );

  // Use Pino logger for the entire application
  app.useLogger(app.get(Logger));

  // Let NestJS handle SIGTERM/SIGINT via shutdown hooks.
  // This avoids duplicated signal handling across the app.
  app.enableShutdownHooks();

  const configService = app.get(ConfigService);
  const logger = app.get(Logger);

  const appConfig = configService.get<AppConfig>('app');
  if (!appConfig) {
    throw new Error('Application configuration is missing');
  }

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  // Configure global API prefix from configuration
  // If appConfig.basePath is set, prepend it to 'api/v1'
  const globalPrefix = appConfig.basePath ? `${appConfig.basePath}/api/v1` : 'api/v1';
  app.setGlobalPrefix(globalPrefix);

  // Register SPA fallback filter to serve index.html for non-API 404s
  app.useGlobalFilters(new SpaFallbackFilter(globalPrefix));

  // Register BigInt interceptor to handle serialization
  app.useGlobalInterceptors(new BigIntInterceptor());

  // Serve static assets from ui/dist (Nuxt static build)
  // We resolve the path relative to the current file location
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const staticRoot = path.resolve(__dirname, '..', '..', 'ui', '.output', 'public');
  logger.log(`Serving static files from: ${staticRoot}`, 'Bootstrap');

  // Register helmet for security headers
  // We configure CSP to allow Telegram widgets and Nuxt scripts
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          'https://telegram.org',
          'https://*.telegram.org',
        ],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:', 'http:'], // Allow external images (like from Telegram)
        fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
        connectSrc: ["'self'", 'https:', 'wss:', 'http:'], // Allow connections to API and external services
        frameSrc: [
          "'self'",
          'https://telegram.org',
          'https://*.telegram.org',
          'https://oauth.telegram.org',
        ], // Allow Telegram login widget
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xFrameOptions: false,
  });

  // Register the fastify-static plugin to serve the frontend files
  await app.register(fastifyStatic, {
    root: staticRoot,
    prefix: '/',
    wildcard: false, // Disable wildcard, we handle SPA fallback via exception filter
  });

  // Register multipart support for file uploads
  await app.register(multipart, {
    limits: {
      fileSize: appConfig.media.maxFileSize,
      files: 1,
      fields: 20,
      parts: 25,
      fieldSize: 1024 * 1024,
      headerPairs: 2000,
    },
  });

  const fastifyInstance = app.getHttpAdapter().getInstance();
  fastifyInstance.addContentTypeParser(
    /^audio\/.*$/,
    { parseAs: 'buffer' },
    (_req: unknown, payload: unknown, done: (err: Error | null, body?: unknown) => void) => {
      done(null, payload);
    },
  );

  await app.listen(appConfig.port, appConfig.host);

  logger.log(
    `🚀 NestJS service is running on: http://${appConfig.host}:${appConfig.port}/${globalPrefix}`,
    'Bootstrap',
  );
  logger.log(`📊 Environment: ${appConfig.nodeEnv}`, 'Bootstrap');
  logger.log(`📝 Log level: ${appConfig.logLevel}`, 'Bootstrap');

  process.on('uncaughtException', error => {
    logger.error(`Uncaught Exception: ${error.message}`, error.stack, 'Bootstrap');
    void app
      .close()
      .catch(closeError => {
        const message = closeError instanceof Error ? closeError.message : String(closeError);
        const stack = closeError instanceof Error ? closeError.stack : undefined;
        logger.error(
          `Error during shutdown after uncaughtException: ${message}`,
          stack,
          'Bootstrap',
        );
      })
      .finally(() => {
        process.exit(1);
      });
  });

  process.on('unhandledRejection', reason => {
    const message = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;
    logger.error(`Unhandled Rejection: ${message}`, stack, 'Bootstrap');
    void app
      .close()
      .catch(closeError => {
        const closeMessage = closeError instanceof Error ? closeError.message : String(closeError);
        const closeStack = closeError instanceof Error ? closeError.stack : undefined;
        logger.error(
          `Error during shutdown after unhandledRejection: ${closeMessage}`,
          closeStack,
          'Bootstrap',
        );
      })
      .finally(() => {
        process.exit(1);
      });
  });
}

void bootstrap();
