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
        return new Redis({
          host: config.host,
          port: config.port,
          password: config.password,
          db: config.db,
        });
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
