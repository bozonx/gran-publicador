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

  private async ensureConnected(client: Redis): Promise<void> {
    if (client.status === 'ready') {
      return;
    }

    if (client.status === 'wait') {
      await client.connect();
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const onReady = () => {
        cleanup();
        resolve();
      };

      const onError = (error: unknown) => {
        cleanup();
        reject(error);
      };

      const cleanup = () => {
        client.off('ready', onReady);
        client.off('error', onError);
      };

      client.on('ready', onReady);
      client.on('error', onError);
    });
  }

  constructor(
    appOrHttpServer: any,
    private readonly configService: ConfigService,
  ) {
    super(appOrHttpServer);
  }

  async connectToRedis(): Promise<void> {
    const config = this.configService.get<RedisConfig>('redis')!;

    const isUpstash = config.url.includes('upstash.io');
    const redisOptions: any = {};
    if (isUpstash) {
      redisOptions.family = 0;
    }
    const pubClient = new Redis(config.url, redisOptions);
    const subClient = pubClient.duplicate();

    await Promise.all([this.ensureConnected(pubClient), this.ensureConnected(subClient)]);

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
