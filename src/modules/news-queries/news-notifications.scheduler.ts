import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProjectsService } from '../projects/projects.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { I18nService } from 'nestjs-i18n';
import { NewsConfig } from '../../config/news.config.js';
import { RedisService } from '../../common/redis/redis.service.js';
import {
  NEWS_NOTIFICATIONS_QUEUE,
  PROCESS_NEWS_QUERY_JOB,
  ProcessNewsQueryJobData,
} from './news-notifications.queue.js';

export interface NewsNotificationsRunResult {
  skipped: boolean;
  reason?: string;
  checkedQueriesCount: number;
  failedQueriesCount: number;
  queriesWithNewItemsCount: number;
  createdNotificationsCount: number;
  queuedQueriesCount?: number;
}

interface NewsNotificationState {
  userId: string;
  queryId: string;
  lastSentSavedAt: Date;
  lastSentNewsId: string;
}

@Injectable()
export class NewsNotificationsScheduler {
  private readonly logger = new Logger(NewsNotificationsScheduler.name);
  private readonly lockKey = 'news_notifications_scheduler';

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
    private readonly notificationsService: NotificationsService,
    private readonly i18n: I18nService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    @InjectQueue(NEWS_NOTIFICATIONS_QUEUE)
    private readonly newsNotificationsQueue: Queue<ProcessNewsQueryJobData>,
  ) {}

  public async runNow(): Promise<NewsNotificationsRunResult> {
    const lockToken = await this.redisService.acquireLock(this.lockKey, 10 * 60 * 1000); // 10 min lock
    if (!lockToken) {
      this.logger.debug('Skipping news notifications check (distributed lock not acquired)');
      return {
        skipped: true,
        reason: 'distributed_lock_not_acquired',
        checkedQueriesCount: 0,
        failedQueriesCount: 0,
        queriesWithNewItemsCount: 0,
        createdNotificationsCount: 0,
      };
    }

    try {
      this.logger.log('Starting news notifications check...');

      // Find queries enabled for notifications
      const queries = await this.prisma.projectNewsQuery.findMany({
        where: { isNotificationEnabled: true },
        include: {
          project: {
            include: {
              owner: { select: { id: true, uiLanguage: true } },
              members: {
                include: {
                  user: { select: { id: true, uiLanguage: true } },
                },
              },
            },
          },
        },
      });

      this.logger.debug(`Found ${queries.length} active queries to queue`);

      let failedQueriesCount = 0;
      let queuedQueriesCount = 0;

      for (const query of queries) {
        try {
          await this.newsNotificationsQueue.add(
            PROCESS_NEWS_QUERY_JOB,
            { queryId: query.id },
            {
              jobId: `news-query-${query.id}-${Date.now()}`,
              removeOnComplete: true,
              removeOnFail: false,
            },
          );
          queuedQueriesCount += 1;
        } catch (error: any) {
          failedQueriesCount += 1;
          this.logger.error(
            `Failed to queue news notifications for query ${query.id}: ${error.message}`,
          );
        }
      }

      return {
        skipped: false,
        checkedQueriesCount: queries.length,
        failedQueriesCount,
        queriesWithNewItemsCount: 0,
        createdNotificationsCount: 0,
        queuedQueriesCount,
      };
    } finally {
      await this.redisService.releaseLock(this.lockKey, lockToken);
    }
  }

  public async processQueryById(queryId: string): Promise<void> {
    const query = await this.prisma.projectNewsQuery.findUnique({
      where: { id: queryId },
      include: {
        project: {
          include: {
            owner: { select: { id: true, uiLanguage: true } },
            members: {
              include: {
                user: { select: { id: true, uiLanguage: true } },
              },
            },
          },
        },
      },
    });

    if (!query || !query.isNotificationEnabled) {
      this.logger.debug(`Query ${queryId} not found or notifications disabled`);
      return;
    }

    await this.processQuery(query);
  }

  private async processQuery(query: any): Promise<{
    hasNewItems: boolean;
    createdNotificationsCount: number;
  }> {
    const config = this.configService.get<NewsConfig>('news');
    const lookbackHours = config?.schedulerLookbackHours || 3;
    const fetchLimit = config?.schedulerFetchLimit || 100;
    const settings = query.settings || {};

    // Calculate cutoff time
    const cutoffDate = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);
    const usersToNotify = this.getUsersToNotify(query);
    if (usersToNotify.size === 0) {
      return {
        hasNewItems: false,
        createdNotificationsCount: 0,
      };
    }

    const existingStates = await this.getUserStates(query.id, Array.from(usersToNotify.keys()));

    const stateByUserId = new Map(existingStates.map(state => [state.userId, state]));

    let hasNewItems = false;
    let createdNotificationsCount = 0;

    for (const [userId, lang] of usersToNotify.entries()) {
      const existingState = stateByUserId.get(userId);
      const { items, newestItem } = await this.fetchNewItemsForUser({
        query,
        settings,
        userId,
        existingState,
        cutoffDate,
        fetchLimit,
      });

      if (items.length === 0 || !newestItem) {
        continue;
      }

      hasNewItems = true;
      this.logger.log(
        `Found ${items.length} new news for user ${userId}, project ${query.projectId}, query ${query.name}`,
      );

      const titlesList = items
        .slice(0, 5)
        .map((item: any) => `• ${item.title}`)
        .join('\n');
      const suffix = items.length > 5 ? `\n... (+${items.length - 5})` : '';

      const messageBase = this.i18n.t('notifications.NEW_NEWS_MESSAGE', {
        lang,
        args: {
          count: items.length,
          queryName: query.name,
        },
      });

      const notification = await this.notificationsService.create({
        userId,
        type: 'NEW_NEWS' as any,
        title: this.i18n.t('notifications.NEW_NEWS_TITLE', {
          lang,
          args: { queryName: query.name },
        }),
        message: `${messageBase}\n\n${titlesList}${suffix}`,
        meta: {
          projectId: query.projectId,
          queryId: query.id,
          newsCount: items.length,
          firstNewsTitle: items[0]?.title,
          firstNewsId: items[0]?._id || items[0]?.id,
        },
      });

      if (notification) {
        createdNotificationsCount += 1;
      }

      await this.upsertUserState({
        userId,
        queryId: query.id,
        lastSentSavedAt: new Date(newestItem._savedAt || newestItem.savedAt),
        lastSentNewsId: newestItem._id || newestItem.id,
      });
    }

    return {
      hasNewItems,
      createdNotificationsCount,
    };
  }

  private getUsersToNotify(query: any): Map<string, string> {
    const usersToNotify = new Map<string, string>();

    if (query.project.owner) {
      usersToNotify.set(query.project.owner.id, query.project.owner.uiLanguage || 'en-US');
    }

    if (query.project.members) {
      query.project.members.forEach((member: any) => {
        if (member.user) {
          usersToNotify.set(member.user.id, member.user.uiLanguage || 'en-US');
        }
      });
    }

    return usersToNotify;
  }

  private async fetchNewItemsForUser(params: {
    query: any;
    settings: Record<string, any>;
    userId: string;
    existingState?: NewsNotificationState;
    cutoffDate: Date;
    fetchLimit: number;
  }): Promise<{ items: any[]; newestItem: any | null }> {
    const { query, settings, userId, existingState, cutoffDate, fetchLimit } = params;

    const allItems: any[] = [];
    let currentCursor: string | null = null;
    let hasMore = true;
    const limit = 20;
    let newestItemEver: any = null;

    while (hasMore) {
      let mode = settings.mode;
      if (!mode || !['text', 'vector', 'hybrid'].includes(mode)) {
        mode = 'hybrid';
      }

      const searchParams: any = {
        q: settings.q || '',
        mode,
        lang: settings.lang,
        sourceTags: Array.isArray(settings.sourceTags)
          ? settings.sourceTags.join(',')
          : settings.sourceTags,
        source: settings.source,
        sources: Array.isArray(settings.sources) ? settings.sources.join(',') : settings.sources,
        minScore: settings.minScore,
        limit,
        orderBy: 'savedAt',
      };

      if (currentCursor) {
        searchParams.cursor = currentCursor;
      } else if (existingState && existingState.lastSentSavedAt > cutoffDate) {
        searchParams.afterSavedAt = existingState.lastSentSavedAt.toISOString();
        searchParams.afterId = existingState.lastSentNewsId;
      } else {
        searchParams.savedFrom = cutoffDate.toISOString();
      }

      const results = await this.projectsService.searchNews(query.projectId, userId, searchParams);
      const items = results.items || (Array.isArray(results) ? results : []);

      if (items.length > 0) {
        // Strict client-side filter to prevent duplicate notifications
        const filteredItems = items.filter((item: any) => {
          if (!existingState) return true;

          const itemSavedAt = new Date(item._savedAt || item.savedAt);
          if (isNaN(itemSavedAt.getTime())) return true; // fallback if date is invalid

          const itemId = item._id || item.id;

          if (itemSavedAt < existingState.lastSentSavedAt) return false;

          if (itemSavedAt.getTime() === existingState.lastSentSavedAt.getTime()) {
            if (itemId === existingState.lastSentNewsId) return false;
            return false;
          }

          return true;
        });

        if (filteredItems.length > 0) {
          allItems.push(...filteredItems);
          if (!newestItemEver) {
            newestItemEver = filteredItems[0];
          }
        }
      }

      currentCursor = results.nextCursor || null;
      hasMore = !!currentCursor && items.length > 0;

      if (allItems.length >= fetchLimit) {
        this.logger.warn(
          `Reached fetch limit (${fetchLimit}) for query ${query.id}, user ${userId}, stopping pagination`,
        );
        hasMore = false;
      }
    }

    return {
      items: allItems,
      newestItem: newestItemEver,
    };
  }

  private async getUserStates(
    queryId: string,
    userIds: string[],
  ): Promise<NewsNotificationState[]> {
    if (userIds.length === 0) {
      return [];
    }

    const states = await this.prisma.newsNotificationUserState.findMany({
      where: {
        queryId,
        userId: { in: userIds },
      },
      select: {
        userId: true,
        queryId: true,
        lastSentSavedAt: true,
        lastSentNewsId: true,
      },
    });

    return states as NewsNotificationState[];
  }

  private async upsertUserState(state: NewsNotificationState): Promise<void> {
    await this.prisma.newsNotificationUserState.upsert({
      where: {
        userId_queryId: {
          userId: state.userId,
          queryId: state.queryId,
        },
      },
      update: {
        lastSentSavedAt: state.lastSentSavedAt,
        lastSentNewsId: state.lastSentNewsId,
      },
      create: {
        userId: state.userId,
        queryId: state.queryId,
        lastSentSavedAt: state.lastSentSavedAt,
        lastSentNewsId: state.lastSentNewsId,
      },
    });
  }
}
