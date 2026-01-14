import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, SchedulerRegistry } from '@nestjs/schedule';
import { PostStatus, PublicationStatus } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SocialPostingService } from './social-posting.service.js';
import { AppConfig } from '../../config/app.config.js';

@Injectable()
export class PublicationSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PublicationSchedulerService.name);
  private isProcessing = false;
  private initialTimeout: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly socialPostingService: SocialPostingService,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit() {
    const appConfig = this.configService.get<AppConfig>('app')!;
    this.logger.log(`Date source of truth: ${new Date().toISOString()}`);

    const intervalSeconds = appConfig.schedulerIntervalSeconds;
    const intervalMs = intervalSeconds * 1000;

    // Align start to the next interval boundary for better precision
    const now = Date.now();
    const delay = intervalMs - (now % intervalMs);

    this.logger.log(`Aligning scheduler: first run in ${delay}ms`);

    this.initialTimeout = setTimeout(() => {
        this.handleCron();
        const interval = setInterval(() => this.handleCron(), intervalMs);
        this.schedulerRegistry.addInterval('publication-scheduler', interval);
    }, delay);

    this.logger.log(
      `Publication Scheduler initialized with dynamic interval ${appConfig.schedulerIntervalSeconds}s and window ${appConfig.schedulerWindowMinutes}m`,
    );
  }

  onModuleDestroy() {
    if (this.initialTimeout) {
      clearTimeout(this.initialTimeout);
      this.initialTimeout = null;
    }
    
    try {
      if (this.schedulerRegistry.doesExist('interval', 'publication-scheduler')) {
         this.schedulerRegistry.deleteInterval('publication-scheduler');
      }
    } catch (e) {
      // Ignore errors if interval doesn't exist
    }
  }

  async handleCron() {
    if (this.isProcessing) {
      this.logger.debug('Skipping scheduler run (previous run still in progress)');
      return;
    }

    this.isProcessing = true;
    try {
      const appConfig = this.configService.get<AppConfig>('app')!;
      const now = new Date();
      const windowStart = new Date(now.getTime() - appConfig.schedulerWindowMinutes * 60000);

      // 1. Blindly mark expired publications and posts
      await this.markExpired(windowStart);

      // 2. Process publications that are ready
      await this.processScheduledPublications(now);
    } catch (error: any) {
      this.logger.error(`Error in scheduler run: ${error.message}`, error.stack);
    } finally {
      this.isProcessing = false;
    }
  }

  private async markExpired(windowStart: Date) {
    // 1. Find and Mark Publications
    const pubsToExpire = await this.prisma.publication.findMany({
      where: {
        status: PublicationStatus.SCHEDULED,
        scheduledAt: { lt: windowStart },
        archivedAt: null,
        project: { archivedAt: null },
      },
      select: { id: true },
    });

    if (pubsToExpire.length > 0) {
      const expiredPubs = await this.prisma.publication.updateMany({
        where: { id: { in: pubsToExpire.map((p) => p.id) } },
        data: { status: PublicationStatus.EXPIRED },
      });
      if (expiredPubs.count > 0) {
        this.logger.log(`Marked ${expiredPubs.count} publications as EXPIRED`);
      }
    }

    // 2. Find and Mark Posts
    const postsToExpire = await this.prisma.post.findMany({
      where: {
        status: PostStatus.PENDING,
        scheduledAt: { lt: windowStart },
        publication: {
          archivedAt: null,
          project: { archivedAt: null },
        },
        channel: {
          isActive: true,
          archivedAt: null,
        },
      },
      select: { id: true },
    });

    if (postsToExpire.length > 0) {
      const expiredPosts = await this.prisma.post.updateMany({
        where: { id: { in: postsToExpire.map((p) => p.id) } },
        data: {
          status: PostStatus.FAILED,
          errorMessage: 'EXPIRED',
        },
      });

      if (expiredPosts.count > 0) {
        this.logger.log(`Marked ${expiredPosts.count} posts as EXPIRED`);
      }
    }
  }

  private async processScheduledPublications(now: Date) {
    // Fetch publications that are SCHEDULED and due
    // IMPORTANT: Order by scheduledAt ASC to ensure "Part 1" goes before "Part 2"
    // Also including createdAt as secondary sort for identical scheduledAt times
    const publications = await this.prisma.publication.findMany({
      where: {
        archivedAt: null,
        project: { archivedAt: null },
        OR: [
          // 1. Classic scheduled publication
          { 
            status: PublicationStatus.SCHEDULED,
            OR: [
              { scheduledAt: { lte: now } },
              { posts: { some: { scheduledAt: { lte: now } } } },
            ]
          },
        ],
      },
      select: { id: true, scheduledAt: true, createdAt: true },
      orderBy: [
        { scheduledAt: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    if (publications.length === 0) return;

    this.logger.debug(`Found ${publications.length} publications to trigger`);

    // Sequential trigger to maintain strict delivery order
    // This is crucial for multi-part messages in the same channel
    for (const pub of publications) {
        await this.triggerPublication(pub.id);
    }
  }


  private async triggerPublication(publicationId: string) {
    try {
      // Atomic status update to prevent race conditions
      // Update from SCHEDULED -> PROCESSING
      // If it was already picked up, this update will return count 0
      const updateResult = await this.prisma.publication.updateMany({
        where: {
          id: publicationId,
          status: PublicationStatus.SCHEDULED,
        },
        data: {
          status: PublicationStatus.PROCESSING,
          processingStartedAt: new Date(),
        },
      });

      if (updateResult.count === 1) {
        this.logger.log(`Triggering publication ${publicationId}`);
        // Run publication using existing service logic, skipping lock check
        await this.socialPostingService.publishPublication(publicationId, { skipLock: true });
      }
    } catch (error: any) {
        this.logger.error(`Failed to trigger publication ${publicationId}: ${error.message}`);
    }
  }
}
