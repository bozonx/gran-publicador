import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../common/redis/redis.module.js';
import { AppConfig } from '../../config/app.config.js';

export interface TelegramSession {
  menu: 'home' | 'collect';
  publicationId: string;
  menuMessageId: number;
  createdAt: string;
  metadata: {
    sourceTextsCount: number;
    mediaCount: number;
  };
}

/**
 * Service for managing Telegram bot user sessions in Redis.
 * Sessions track the current menu state and associated publication draft.
 */
@Injectable()
export class TelegramSessionService {
  private readonly logger = new Logger(TelegramSessionService.name);
  private readonly ttlSeconds: number;
  private readonly inMemoryStore = new Map<string, { data: TelegramSession; expiresAt: number }>();

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
    private readonly configService: ConfigService,
  ) {
    const appConfig = this.configService.get<AppConfig>('app')!;
    this.ttlSeconds = appConfig.telegramSessionTtlMinutes * 60;
  }

  /**
   * Get session key for Redis
   */
  private getKey(telegramUserId: string): string {
    return `telegram:session:${telegramUserId}`;
  }

  /**
   * Create or update a session
   */
  async setSession(telegramUserId: string, session: TelegramSession): Promise<void> {
    const key = this.getKey(telegramUserId);

    if (this.redis) {
      try {
        await this.redis.set(key, JSON.stringify(session), 'EX', this.ttlSeconds);
        this.logger.debug(`Session set for user ${telegramUserId}, TTL: ${this.ttlSeconds}s`);
      } catch (error) {
        this.logger.error(`Failed to set session in Redis: ${error}`);
        // Fallback to in-memory
        this.setInMemory(telegramUserId, session);
      }
    } else {
      this.setInMemory(telegramUserId, session);
    }
  }

  /**
   * Get a session
   */
  async getSession(telegramUserId: string): Promise<TelegramSession | null> {
    const key = this.getKey(telegramUserId);

    if (this.redis) {
      try {
        const data = await this.redis.get(key);
        if (!data) return null;

        return JSON.parse(data) as TelegramSession;
      } catch (error) {
        this.logger.error(`Failed to get session from Redis: ${error}`);
        // Fallback to in-memory
        return this.getInMemory(telegramUserId);
      }
    } else {
      return this.getInMemory(telegramUserId);
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(telegramUserId: string): Promise<void> {
    const key = this.getKey(telegramUserId);

    if (this.redis) {
      try {
        await this.redis.del(key);
        this.logger.debug(`Session deleted for user ${telegramUserId}`);
      } catch (error) {
        this.logger.error(`Failed to delete session from Redis: ${error}`);
        // Fallback to in-memory
        this.deleteInMemory(telegramUserId);
      }
    } else {
      this.deleteInMemory(telegramUserId);
    }
  }

  /**
   * Update session metadata (increments counters and resets TTL)
   */
  async updateMetadata(
    telegramUserId: string,
    updates: Partial<TelegramSession['metadata']>,
  ): Promise<void> {
    const session = await this.getSession(telegramUserId);
    if (!session) {
      this.logger.warn(`Cannot update metadata: session not found for user ${telegramUserId}`);
      return;
    }

    session.metadata = {
      ...session.metadata,
      ...updates,
    };

    await this.setSession(telegramUserId, session);
  }

  // In-memory fallback methods

  private setInMemory(telegramUserId: string, session: TelegramSession): void {
    const expiresAt = Date.now() + this.ttlSeconds * 1000;
    this.inMemoryStore.set(telegramUserId, { data: session, expiresAt });
    this.logger.debug(`Session set in memory for user ${telegramUserId}`);
  }

  private getInMemory(telegramUserId: string): TelegramSession | null {
    const entry = this.inMemoryStore.get(telegramUserId);
    if (!entry) return null;

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.inMemoryStore.delete(telegramUserId);
      return null;
    }

    return entry.data;
  }

  private deleteInMemory(telegramUserId: string): void {
    this.inMemoryStore.delete(telegramUserId);
    this.logger.debug(`Session deleted from memory for user ${telegramUserId}`);
  }

  /**
   * Get last menu message ID key for Redis
   */
  private getLastMenuMessageKey(telegramUserId: string): string {
    return `telegram:last_menu:${telegramUserId}`;
  }

  /**
   * Store the last menu message ID (with 24h TTL)
   * This allows us to delete old menu messages when creating new ones
   */
  async setLastMenuMessageId(telegramUserId: string, messageId: number): Promise<void> {
    const key = this.getLastMenuMessageKey(telegramUserId);
    const ttl = 24 * 60 * 60; // 24 hours

    if (this.redis) {
      try {
        await this.redis.set(key, String(messageId), 'EX', ttl);
        this.logger.debug(`Last menu message ID set for user ${telegramUserId}: ${messageId}`);
      } catch (error) {
        this.logger.error(`Failed to set last menu message ID in Redis: ${error}`);
      }
    }
  }

  /**
   * Get the last menu message ID
   */
  async getLastMenuMessageId(telegramUserId: string): Promise<number | null> {
    const key = this.getLastMenuMessageKey(telegramUserId);

    if (this.redis) {
      try {
        const data = await this.redis.get(key);
        return data ? parseInt(data, 10) : null;
      } catch (error) {
        this.logger.error(`Failed to get last menu message ID from Redis: ${error}`);
        return null;
      }
    }

    return null;
  }

  /**
   * Delete the last menu message ID
   */
  async deleteLastMenuMessageId(telegramUserId: string): Promise<void> {
    const key = this.getLastMenuMessageKey(telegramUserId);

    if (this.redis) {
      try {
        await this.redis.del(key);
        this.logger.debug(`Last menu message ID deleted for user ${telegramUserId}`);
      } catch (error) {
        this.logger.error(`Failed to delete last menu message ID from Redis: ${error}`);
      }
    }
  }
}
