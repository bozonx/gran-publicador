import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProjectsService } from '../projects/projects.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { I18nService } from 'nestjs-i18n';
import { NewsConfig } from '../../config/news.config.js';

@Injectable()
export class NewsNotificationsScheduler implements OnModuleInit {
  private readonly logger = new Logger(NewsNotificationsScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
    private readonly notificationsService: NotificationsService,
    private readonly i18n: I18nService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    const config = this.configService.get<NewsConfig>('news');
    const intervalMinutes = config?.notificationIntervalMinutes || 10;
    
    this.logger.log(`Scheduling news notifications check every ${intervalMinutes} minutes`);
    
    const interval = setInterval(
      () => this.handleNewsNotifications(), 
      intervalMinutes * 60 * 1000
    );
    this.schedulerRegistry.addInterval('news-notifications', interval);
  }

  async handleNewsNotifications() {
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
                user: { select: { id: true, uiLanguage: true } } 
              } 
            },
          }
        }
      }
    });

    this.logger.debug(`Found ${queries.length} active queries to check`);

    for (const query of queries) {
      try {
        await this.processQuery(query);
      } catch (error: any) {
        this.logger.error(`Failed to process news notifications for query ${query.id}: ${error.message}`);
      }
    }
  }

  private async processQuery(query: any) {
    const config = this.configService.get<NewsConfig>('news');
    const lookbackHours = config?.schedulerLookbackHours || 3;
    const settings = (query.settings as any) || {};
    
    // Calculate cutoff time
    const cutoffDate = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);
    
    const lastCheckedAt = query.lastCheckedAt ? new Date(query.lastCheckedAt) : null;
    const lastId = settings.lastId || null;

    const allItems: any[] = [];
    let currentCursor: string | null = null;
    let hasMore = true;
    const limit = 20;

    // Use a temporary variable to store the "newest" item we find across all pages
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
        orderBy: 'savedAt', // Always order by savedAt to ensure deterministic incremental polling
      };

      if (currentCursor) {
        // According to API: Do not mix cursor with afterSavedAt/afterId
        searchParams.cursor = currentCursor;
      } else {
        // Watermark logic for the first page
        if (lastCheckedAt && lastCheckedAt > cutoffDate) {
          searchParams.afterSavedAt = lastCheckedAt.toISOString();
          if (lastId) {
            searchParams.afterId = lastId;
          }
        } else {
          // Fallback: start fresh from cutoff
          searchParams.savedFrom = cutoffDate.toISOString();
        }
      }
      
      // Call service
      const results = (await this.projectsService.searchNews(query.projectId, query.project.ownerId, searchParams)) as any;
      const items = results.items || (Array.isArray(results) ? results : []);
      
      if (items.length > 0) {
        allItems.push(...items);
        
        // Track the absolutely newest item (which should be items[0] in the first batch since it's sorted DESC)
        if (!newestItemEver) {
          newestItemEver = items[0];
        }
      }

      // Pagination logic
      currentCursor = results.nextCursor || null;
      // Continue if we have a cursor and we actually got some items (to avoid infinite loops)
      hasMore = !!currentCursor && items.length > 0;
      
      // Safety break to avoid fetching thousands of items in one run
      if (allItems.length >= (config?.schedulerFetchLimit || 100)) {
        this.logger.warn(`Reached fetch limit (${config?.schedulerFetchLimit || 100}) for query ${query.id}, stopping pagination`);
        hasMore = false;
      }

    }

    if (allItems.length > 0) {
      this.logger.log(`Found ${allItems.length} new news for project ${query.projectId}, query ${query.name}`);
      
      // Notify owner and members
      const usersToNotify = new Map<string, string>(); // userId -> uiLanguage
      
      if (query.project.owner) {
        usersToNotify.set(query.project.owner.id, query.project.owner.uiLanguage || 'en-US');
      }
      
      if (query.project.members) {
        query.project.members.forEach((m: any) => {
          if (m.user) {
            usersToNotify.set(m.user.id, m.user.uiLanguage || 'en-US');
          }
        });
      }

      // Prepare titles for the message (list from the beginning of allItems, which are newest)
      const titlesList = allItems
        .slice(0, 5)
        .map((item: any) => `• ${item.title}`)
        .join('\n');
      const suffix = allItems.length > 5 ? `\n... (+${allItems.length - 5})` : '';

      for (const [userId, lang] of usersToNotify.entries()) {
        const messageBase = this.i18n.t('notifications.NEW_NEWS_MESSAGE', { 
          lang, 
          args: { 
            count: allItems.length,
            queryName: query.name 
          } 
        });

        await this.notificationsService.create({
          userId,
          type: 'NEW_NEWS' as any,
          title: this.i18n.t('notifications.NEW_NEWS_TITLE', { lang, args: { queryName: query.name } }),
          message: `${messageBase}\n\n${titlesList}${suffix}`,
          meta: { 
            projectId: query.projectId, 
            queryId: query.id,
            newsCount: allItems.length,
            firstNewsTitle: allItems[0]?.title
          },
        });
      }

      // Update state
      // newestItemEver holds the newest item from the very first batch (since we use orderBy: 'savedAt' DESC)
      const newLastCheckedAt = new Date(newestItemEver._savedAt);
      const newLastId = newestItemEver._id;
      
      // Preserve existing settings explicitly and update lastId
      const newSettings = { ...settings, lastId: newLastId };

      await this.prisma.projectNewsQuery.update({
        where: { id: query.id },
        data: { 
          lastCheckedAt: newLastCheckedAt,
          settings: newSettings
        }
      });
    }
  }
}
