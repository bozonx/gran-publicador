import { Injectable, Inject, Logger, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants.js';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  private static readonly RELEASE_LOCK_SCRIPT = `
    if redis.call('GET', KEYS[1]) == ARGV[1] then
      return redis.call('DEL', KEYS[1])
    end
    return 0
  `;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis | null) {}

  /**
   * Acquire a distributed lock.
   * @param key Lock key
   * @param ttlMs Time to live in milliseconds
   * @returns lock token if acquired, null otherwise
   */
  async acquireLock(key: string, ttlMs: number): Promise<string | null> {
    if (!this.redis) {
      return null;
    }

    try {
      const token = `${Date.now()}:${Math.random().toString(16).slice(2)}`;
      const result = await this.redis.set(`lock:${key}`, token, 'PX', ttlMs, 'NX');
      return result === 'OK' ? token : null;
    } catch (error: any) {
      this.logger.error(`Failed to acquire lock for ${key}: ${error.message}`);
      return null;
    }
  }

  /**
   * Release a distributed lock.
   * @param key Lock key
   * @param token Lock token received from acquireLock
   */
  async releaseLock(key: string, token: string): Promise<void> {
    if (!this.redis) {
      return;
    }

    try {
      await this.redis.eval(RedisService.RELEASE_LOCK_SCRIPT, 1, `lock:${key}`, token);
    } catch (error: any) {
      this.logger.error(`Failed to release lock for ${key}: ${error.message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.redis) {
      return;
    }

    try {
      await this.redis.quit();
    } catch (error: any) {
      this.logger.error(`Failed to quit Redis client: ${error.message}`);
    }
  }

  /**
   * Check if Redis is enabled and connected
   */
  isEnabled(): boolean {
    return !!this.redis;
  }
}
