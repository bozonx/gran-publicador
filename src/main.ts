import 'reflect-metadata';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyStatic from '@fastify/static';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module.js';
import { SpaFallbackFilter } from './common/filters/spa-fallback.filter.js';
import type { AppConfig } from './config/app.config.js';

/**
 * Validate that DATA_DIR is set before starting the application.
 * This is a REQUIRED environment variable for database configuration.
 */
if (!process.env.DATA_DIR) {
  console.error('❌ FATAL ERROR: DATA_DIR environment variable is not set!');
  console.error('   DATA_DIR must point to the directory where the database file will be stored.');
  console.error('   Example: DATA_DIR=/data or DATA_DIR=./test-data');
  process.exit(1);
}

/**
 * Solves "Do not know how to serialize a BigInt" error.
 */
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

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

  // Register SPA fallback filter to serve 200.html for non-API 404s
  app.useGlobalFilters(new SpaFallbackFilter(globalPrefix));

  // Serve static assets from ui/dist (Nuxt static build)
  // We resolve the path relative to the current file location
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const staticRoot = path.resolve(__dirname, '..', '..', 'ui', '.output', 'public');
  logger.log(`Serving static files from: ${staticRoot}`, 'Bootstrap');

  // Register the fastify-static plugin to serve the frontend files
  await app.register(fastifyStatic, {
    root: staticRoot,
    prefix: '/',
    wildcard: false, // Disable wildcard, we handle SPA fallback via exception filter
  });

  // Enable graceful shutdown hooks to handle signals (SIGINT, SIGTERM) correctly
  app.enableShutdownHooks();

  await app.listen(appConfig.port, appConfig.host);

  logger.log(
    `🚀 NestJS service is running on: http://${appConfig.host}:${appConfig.port}/${globalPrefix}`,
    'Bootstrap',
  );
  logger.log(`📊 Environment: ${appConfig.nodeEnv}`, 'Bootstrap');
  logger.log(`📝 Log level: ${appConfig.logLevel}`, 'Bootstrap');

  // Rely on enableShutdownHooks for graceful shutdown
}

void bootstrap();
