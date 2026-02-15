import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProjectsService } from '../projects/projects.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { I18nService } from 'nestjs-i18n';
import { NewsConfig } from '../../config/news.config.js';
import { Prisma } from '../../generated/prisma/index.js';
import { randomUUID } from 'crypto';

export interface NewsNotificationsRunResult {
  skipped: boolean;
  reason?: string;
  checkedQueriesCount: number;
  failedQueriesCount: number;
  queriesWithNewItemsCount: number;
  createdNotificationsCount: number;
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
  private isProcessing = false;
  private readonly distributedLockName = 'news_notifications_scheduler_lock';

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
    private readonly notificationsService: NotificationsService,
    private readonly i18n: I18nService,
    private readonly configService: ConfigService,
  ) {}

  public async runNow(): Promise<NewsNotificationsRunResult> {
    if (this.isProcessing) {
      this.logger.debug('Skipping news notifications check (previous run still in progress)');
      return {
        skipped: true,
        reason: 'already_processing',
        checkedQueriesCount: 0,
        failedQueriesCount: 0,
        queriesWithNewItemsCount: 0,
        createdNotificationsCount: 0,
      };
    }

    const hasDistributedLock = await this.tryAcquireDistributedLock();
    if (!hasDistributedLock) {
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

    this.isProcessing = true;
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

      this.logger.debug(`Found ${queries.length} active queries to check`);

      let failedQueriesCount = 0;
      let queriesWithNewItemsCount = 0;
      let createdNotificationsCount = 0;

      for (const query of queries) {
        try {
          const result = await this.processQuery(query);
          if (result.hasNewItems) {
            queriesWithNewItemsCount += 1;
          }
          createdNotificationsCount += result.createdNotificationsCount;
        } catch (error: any) {
          failedQueriesCount += 1;
          this.logger.error(
            `Failed to process news notifications for query ${query.id}: ${error.message}`,
          );
        }
      }

      return {
        skipped: false,
        checkedQueriesCount: queries.length,
        failedQueriesCount,
        queriesWithNewItemsCount,
        createdNotificationsCount,
      };
    } finally {
      this.isProcessing = false;
      await this.releaseDistributedLock();
    }
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
          firstNewsId: items[0]?._id,
        },
      });

      if (notification) {
        createdNotificationsCount += 1;
      }

      await this.upsertUserState({
        userId,
        queryId: query.id,
        lastSentSavedAt: new Date(newestItem._savedAt),
        lastSentNewsId: newestItem._id,
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
      const searchParams: any = {
        q: settings.q || '',
        mode: settings.mode,
        lang: settings.lang,
        sourceTags: settings.sourceTags,
        source: settings.source,
        sources: settings.sources,
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

      const results = (await this.projectsService.searchNews(
        query.projectId,
        userId,
        searchParams,
      )) as any;
      const items = results.items || (Array.isArray(results) ? results : []);

      if (items.length > 0) {
        allItems.push(...items);
        if (!newestItemEver) {
          newestItemEver = items[0];
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

    return this.prisma.$queryRaw<NewsNotificationState[]>`
      SELECT
        user_id AS "userId",
        query_id AS "queryId",
        last_sent_saved_at AS "lastSentSavedAt",
        last_sent_news_id AS "lastSentNewsId"
      FROM news_notification_user_states
      WHERE query_id = ${queryId}
        AND user_id IN (${Prisma.join(userIds)})
    `;
  }

  private async upsertUserState(state: NewsNotificationState): Promise<void> {
    const stateId = randomUUID();

    await this.prisma.$executeRaw`
      INSERT INTO news_notification_user_states (
        id,
        user_id,
        query_id,
        last_sent_saved_at,
        last_sent_news_id,
        created_at,
        updated_at
      )
      VALUES (
        ${stateId},
        ${state.userId},
        ${state.queryId},
        ${state.lastSentSavedAt},
        ${state.lastSentNewsId},
        NOW(),
        NOW()
      )
      ON CONFLICT (user_id, query_id)
      DO UPDATE SET
        last_sent_saved_at = EXCLUDED.last_sent_saved_at,
        last_sent_news_id = EXCLUDED.last_sent_news_id,
        updated_at = NOW()
    `;
  }

  private async tryAcquireDistributedLock(): Promise<boolean> {
    try {
      const rows = (await (this.prisma as any).$queryRawUnsafe(
        'SELECT pg_try_advisory_lock(hashtext($1)) AS locked',
        this.distributedLockName,
      )) as Array<{ locked: boolean }>;

      return rows[0]?.locked === true;
    } catch (error: any) {
      this.logger.error(`Failed to acquire news scheduler distributed lock: ${error.message}`);
      return false;
    }
  }

  private async releaseDistributedLock(): Promise<void> {
    try {
      await (this.prisma as any).$queryRawUnsafe(
        'SELECT pg_advisory_unlock(hashtext($1))',
        this.distributedLockName,
      );
    } catch (error: any) {
      this.logger.error(`Failed to release news scheduler distributed lock: ${error.message}`);
    }
  }
}
