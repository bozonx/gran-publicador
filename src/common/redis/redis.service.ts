import { Injectable, Inject, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.module.js';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis | null) {}

  /**
   * Acquire a distributed lock.
   * @param key Lock key
   * @param ttlMs Time to live in milliseconds
   * @returns true if lock was acquired, false otherwise
   */
  async acquireLock(key: string, ttlMs: number): Promise<boolean> {
    if (!this.redis) {
      return false;
    }

    try {
      const result = await this.redis.set(`lock:${key}`, 'locked', 'PX', ttlMs, 'NX');
      return result === 'OK';
    } catch (error: any) {
      this.logger.error(`Failed to acquire lock for ${key}: ${error.message}`);
      return false;
    }
  }

  /**
   * Release a distributed lock.
   * @param key Lock key
   */
  async releaseLock(key: string): Promise<void> {
    if (!this.redis) {
      return;
    }

    try {
      await this.redis.del(`lock:${key}`);
    } catch (error: any) {
      this.logger.error(`Failed to release lock for ${key}: ${error.message}`);
    }
  }

  /**
   * Check if Redis is enabled and connected
   */
  isEnabled(): boolean {
    return !!this.redis;
  }
}
