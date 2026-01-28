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
    const settings = (query.settings as any) || {};
    // Default to last hour if lastCheckedAt is null
    const lastChecked = query.lastCheckedAt ? new Date(query.lastCheckedAt) : new Date(Date.now() - 3600000);
    
    // We search news using current settings
    const results = (await this.projectsService.searchNews(query.projectId, query.project.ownerId, {
      q: settings.q || '',
      mode: settings.mode,
      lang: settings.lang,
      sourceTags: settings.sourceTags,
      newsTags: settings.newsTags,
      minScore: settings.minScore,
      limit: 50,
      // User requested to remove 'since' for now
    })) as any;

    const items = results.items || (Array.isArray(results) ? results : []);
    
    // Filter new items by date (using savedAt if available, otherwise date)
    const newItems = items.filter((item: any) => {
      const itemDate = new Date(item.savedAt || item.date);
      return itemDate > lastChecked;
    });

    if (newItems.length > 0) {
      this.logger.log(`Found ${newItems.length} new news for project ${query.projectId}, query ${query.name}`);
      
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

      // Prepare titles for the message
      const titlesList = newItems
        .slice(0, 5)
        .map((item: any) => `• ${item.title}`)
        .join('\n');
      const suffix = newItems.length > 5 ? `\n... (+${newItems.length - 5})` : '';

      for (const [userId, lang] of usersToNotify.entries()) {
        const messageBase = this.i18n.t('notifications.NEW_NEWS_MESSAGE', { 
          lang, 
          args: { 
            count: newItems.length,
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
            newsCount: newItems.length,
            firstNewsTitle: newItems[0]?.title
          },
        });
      }
    }

    // Update lastCheckedAt to the date of the latest news item found minus 1ms
    if (newItems.length > 0) {
      const maxDate = Math.max(...newItems.map((i: any) => new Date(i.savedAt || i.date).getTime()));
      await this.prisma.projectNewsQuery.update({
        where: { id: query.id },
        data: { lastCheckedAt: new Date(maxDate - 1) }
      });
    } else {
      // If no news found, we still might want to update lastCheckedAt to "now"
      // to avoid checking the same gap again, but user instructions imply only on find
      // Actually, if we don't update, we'll keep checking the same range.
      // But the user said "lastCheckedAt - переделай на дату savedAt самой последней новости минус 1 милисекунда"
      // I'll stick to that.
    }
  }
}
