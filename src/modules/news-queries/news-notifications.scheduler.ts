import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProjectsService } from '../projects/projects.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

@Injectable()
export class NewsNotificationsScheduler {
  private readonly logger = new Logger(NewsNotificationsScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleNewsNotifications() {
    this.logger.log('Starting news notifications check...');

    // Find queries enabled for notifications
    const queries = await this.prisma.projectNewsQuery.findMany({
      where: { isNotificationEnabled: true },
      include: {
        project: {
          include: {
            members: { select: { userId: true } },
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
    // Use enough 'since' to cover the gap
    const results = (await this.projectsService.searchNews(query.projectId, query.project.ownerId, {
      q: settings.q || '',
      mode: settings.mode,
      lang: settings.lang,
      sourceTags: settings.sourceTags,
      newsTags: settings.newsTags,
      minScore: settings.minScore,
      since: '1d', // Always check last 24h to be safe, but filter by date
      limit: 50,
    })) as any;

    const items = results.items || (Array.isArray(results) ? results : []);
    
    // Filter new items by date
    const newItems = items.filter((item: any) => {
      const itemDate = new Date(item.date);
      return itemDate > lastChecked;
    });

    if (newItems.length > 0) {
      this.logger.log(`Found ${newItems.length} new news for project ${query.projectId}, query ${query.name}`);
      
      // Notify owner and members
      const userIds = new Set<string>();
      userIds.add(query.project.ownerId);
      if (query.project.members) {
        query.project.members.forEach((m: any) => userIds.add(m.userId));
      }

      for (const userId of userIds) {
        await this.notificationsService.create({
          userId,
          type: 'NEW_NEWS' as any,
          title: `New news for ${query.name}`,
          message: `Found ${newItems.length} new news items matching your query "${query.name}".`,
          meta: { 
            projectId: query.projectId, 
            queryId: query.id,
            newsCount: newItems.length,
            firstNewsTitle: newItems[0]?.title
          },
        });
      }
    }

    // Update lastCheckedAt to the date of the latest news item found or now
    // If we update to now() every time, we might miss some if microservice has lag
    // but for now now() is safer for polling.
    await this.prisma.projectNewsQuery.update({
      where: { id: query.id },
      data: { lastCheckedAt: new Date() }
    });
  }
}
