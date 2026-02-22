import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { RedisConfig } from '../../config/redis.config.js';
import { REDIS_CLIENT } from './redis.constants.js';
import { RedisService } from './redis.service.js';

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
          const isUpstash = config.url.includes('upstash.io');
          const redisOptions: any = {
            keyPrefix: config.keyPrefix,
            maxRetriesPerRequest: 0,
            enableOfflineQueue: false,
          };

          if (isUpstash) {
            redisOptions.family = 0; // Prevent IPv6 issues with Upstash on some Node runtimes
          }

          return new Redis(config.url, redisOptions);
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
