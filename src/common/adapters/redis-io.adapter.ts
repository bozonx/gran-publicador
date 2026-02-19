import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import type { ConfigService } from '@nestjs/config';
import type { RedisConfig } from '../../config/redis.config.js';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: any;
  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;

  constructor(
    appOrHttpServer: any,
    private readonly configService: ConfigService,
  ) {
    super(appOrHttpServer);
  }

  async connectToRedis(): Promise<void> {
    const config = this.configService.get<RedisConfig>('redis')!;

    if (!config.enabled) {
      throw new Error('Redis is disabled, but RedisIoAdapter is required for scalability');
    }

    const pubClient = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db,
    });
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);

    this.pubClient = pubClient;
    this.subClient = subClient;
    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  async disconnectFromRedis(): Promise<void> {
    const pubClient = this.pubClient;
    const subClient = this.subClient;

    this.pubClient = null;
    this.subClient = null;

    await Promise.all([
      pubClient ? pubClient.quit().catch(() => undefined) : Promise.resolve(),
      subClient ? subClient.quit().catch(() => undefined) : Promise.resolve(),
    ]);
  }

  override createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}
