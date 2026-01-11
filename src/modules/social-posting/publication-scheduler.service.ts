import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, SchedulerRegistry } from '@nestjs/schedule';
import { PostStatus, PublicationStatus } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SocialPostingService } from './social-posting.service.js';
import { AppConfig } from '../../config/app.config.js';

@Injectable()
export class PublicationSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(PublicationSchedulerService.name);
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly socialPostingService: SocialPostingService,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit() {
    const appConfig = this.configService.get<AppConfig>('app')!;
    this.logger.log(`Date source of truth: ${new Date().toISOString()}`);

    const intervalMs = appConfig.schedulerIntervalSeconds * 1000;
    const interval = setInterval(() => this.handleCron(), intervalMs);
    this.schedulerRegistry.addInterval('publication-scheduler', interval);

    this.logger.log(
      `Publication Scheduler initialized with dynamic interval ${appConfig.schedulerIntervalSeconds}s and window ${appConfig.schedulerWindowMinutes}m`,
    );
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
    // Mark publications EXPIRED
    const expiredPubs = await this.prisma.publication.updateMany({
      where: {
        status: PublicationStatus.SCHEDULED,
        scheduledAt: { lt: windowStart },
      },
      data: { status: PublicationStatus.EXPIRED },
    });

    if (expiredPubs.count > 0) {
      this.logger.log(`Marked ${expiredPubs.count} publications as EXPIRED`);
    }

    // Mark individual posts as EXPIRED (FAILED with error message)
    // We only mark posts of SCHEDULED/PROCESSING/PARTIAL/FAILED publications
    // if the post itself is proсрочено.
    const expiredPosts = await this.prisma.post.updateMany({
      where: {
        status: PostStatus.PENDING,
        scheduledAt: { lt: windowStart },
      },
      data: {
        status: PostStatus.FAILED,
        errorMessage: 'EXPIRED',
      },
    });

    if (expiredPosts.count > 0) {
      this.logger.log(`Marked ${expiredPosts.count} posts as EXPIRED`);
    }
  }

  private async processScheduledPublications(now: Date) {
    // Fetch publications that are SCHEDULED and hit the time
    // We also include publications that have posts with hit the time (if publication.scheduledAt is null)
    const publications = await this.prisma.publication.findMany({
      where: {
        status: PublicationStatus.SCHEDULED,
        OR: [
          { scheduledAt: { lte: now } },
          { posts: { some: { scheduledAt: { lte: now } } } },
        ],
      },
      select: { id: true },
    });

    if (publications.length === 0) return;

    this.logger.debug(`Found ${publications.length} publications to trigger`);

    // Parallel trigger with basic limitation (batching or just Promise.all if count is low)
    // For now, let's use all settled. In production, we might want a limit.
    await Promise.allSettled(
      publications.map((pub) => this.triggerPublication(pub.id)),
    );
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
