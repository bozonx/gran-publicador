import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { RedisConfig } from '../../config/redis.config.js';
import { RedisService } from './redis.service.js';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const config = configService.get<RedisConfig>('redis')!;
        const logger = new Logger(RedisModule.name);

        if (!config.enabled) {
          return null;
        }

        try {
          return new Redis({
            host: config.host,
            port: config.port,
            password: config.password,
            db: config.db,
            keyPrefix: config.keyPrefix,
            lazyConnect: true, // Don't connect immediately
            maxRetriesPerRequest: 0, // Fail fast if redis is down
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const stack = error instanceof Error ? error.stack : undefined;
          logger.error(`Failed to create Redis client: ${message}`, stack);
          return null;
        }
      },
    },
    RedisService,
  ],
  exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule {}
