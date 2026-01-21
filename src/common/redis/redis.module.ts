import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { RedisConfig } from '../../config/redis.config.js';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const config = configService.get<RedisConfig>('redis')!;

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
          console.error('Failed to create Redis client:', error);
          return null;
        }
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
