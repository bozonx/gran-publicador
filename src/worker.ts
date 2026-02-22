import 'reflect-metadata';

import { Logger } from 'nestjs-pino';
import { Logger as NestLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  const logger = app.get(Logger);
  logger.log('Worker started');
}

bootstrap().catch(err => {
  const logger = new NestLogger('WorkerBootstrap');
  if (err instanceof Error) {
    logger.error(err.message, err.stack);
  } else {
    logger.error(String(err));
  }
  process.exit(1);
});
