import { Injectable } from '@nestjs/common';
import { PublicationStatus } from '../../generated/prisma/index.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PublicationsService } from '../publications/publications.service.js';
import { ContentItemsService } from '../content-library/content-items.service.js';
import { ChannelsService } from '../channels/channels.service.js';
import { ProjectsService } from '../projects/projects.service.js';

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private projectsService: ProjectsService,
    private publicationsService: PublicationsService,
    private contentItemsService: ContentItemsService,
    private channelsService: ChannelsService,
  ) {}

  public async getSummary(userId: string) {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // 1. Projects
    const projects = await this.projectsService.findAllForUser(userId);

    // 2. Recent Content (Personal scope by default for dashboard)
    const recentContent = await this.contentItemsService.findAll(
      { scope: 'personal', limit: 10, offset: 0 },
      userId,
    );

    // 3. Channels Summary
    const channels = await this.channelsService.findAllForUser(userId, { limit: 100 });
    const activeChannels = channels.items.filter(c => c.isActive && !c.archivedAt);

    // 4. Publications
    // We'll fetch them in parallel but they need to be grouped by project for the UI
    const [scheduledRes, problemsRes, recentPublishedRes] = await Promise.all([
      this.publicationsService.findAllForUser(userId, {
        status: PublicationStatus.SCHEDULED,
        limit: 50,
      }),
      this.publicationsService.findAllForUser(userId, {
        status: [PublicationStatus.PARTIAL, PublicationStatus.FAILED, PublicationStatus.EXPIRED],
        limit: 50,
      }),
      this.publicationsService.findAllForUser(userId, {
        status: PublicationStatus.PUBLISHED,
        publishedAfter: yesterday,
        limit: 10,
        sortBy: 'byPublished',
        sortOrder: 'desc',
      }),
    ]);

    return {
      projects,
      recentContent: recentContent.items,
      channelsSummary: {
        totalCount: activeChannels.length,
        grouped: this.groupChannelsBySocialMedia(activeChannels),
      },
      publications: {
        scheduled: {
          items: scheduledRes.items,
          total: scheduledRes.total,
          groupedByProject: this.groupByProject(scheduledRes.items),
        },
        problems: {
          items: problemsRes.items,
          total: problemsRes.total,
          groupedByProject: this.groupByProject(problemsRes.items),
        },
        recentPublished: {
          items: recentPublishedRes.items,
          total: recentPublishedRes.total,
        },
      },
      timestamp: new Date().toISOString(),
    };
  }

  private groupByProject(publications: any[]) {
    const groups: Record<string, { project: { id: string; name: string }; publications: any[] }> =
      {};

    publications.forEach(pub => {
      if (!pub.project) return;
      if (!groups[pub.project.id]) {
        groups[pub.project.id] = {
          project: { id: pub.project.id, name: pub.project.name },
          publications: [],
        };
      }
      groups[pub.project.id].publications.push(pub);
    });

    return Object.values(groups).sort((a, b) => a.project.name.localeCompare(b.project.name));
  }

  private groupChannelsBySocialMedia(channels: any[]) {
    const groups: Record<string, { count: number; socialMedia: string }> = {};

    channels.forEach(channel => {
      if (!groups[channel.socialMedia]) {
        groups[channel.socialMedia] = {
          count: 0,
          socialMedia: channel.socialMedia,
        };
      }
      groups[channel.socialMedia].count++;
    });

    return Object.values(groups).sort((a, b) => b.count - a.count);
  }
}
