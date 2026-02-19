import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PostStatus, PublicationStatus, NotificationType } from '../../generated/prisma/index.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SocialPostingService } from './social-posting.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { AppConfig } from '../../config/app.config.js';
import { RedisService } from '../../common/redis/redis.service.js';

export interface PublicationSchedulerRunResult {
  skipped: boolean;
  reason?: string;
  expiredPublicationsCount: number;
  expiredPostsCount: number;
  triggeredPublicationsCount: number;
}

@Injectable()
export class PublicationSchedulerService {
  private readonly logger = new Logger(PublicationSchedulerService.name);
  private readonly lockKey = 'publication_scheduler';

  constructor(
    private readonly prisma: PrismaService,
    private readonly socialPostingService: SocialPostingService,
    private readonly configService: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly redisService: RedisService,
  ) {}

  public async runNow(): Promise<PublicationSchedulerRunResult> {
    const lockToken = await this.redisService.acquireLock(this.lockKey, 10 * 60 * 1000); // 10 min lock
    if (!lockToken) {
      this.logger.debug('Skipping scheduler run (distributed lock not acquired)');
      return {
        skipped: true,
        reason: 'distributed_lock_not_acquired',
        expiredPublicationsCount: 0,
        expiredPostsCount: 0,
        triggeredPublicationsCount: 0,
      };
    }

    try {
      const appConfig = this.configService.get<AppConfig>('app')!;
      const now = new Date();
      const windowStart = new Date(now.getTime() - appConfig.schedulerWindowMinutes * 60000);

      // 1. Blindly mark expired publications and posts
      const expiredStats = await this.markExpired(windowStart);

      // 2. Process publications that are ready
      const triggeredPublicationsCount = await this.processScheduledPublications(now);

      return {
        skipped: false,
        expiredPublicationsCount: expiredStats.expiredPublicationsCount,
        expiredPostsCount: expiredStats.expiredPostsCount,
        triggeredPublicationsCount,
      };
    } catch (error: any) {
      this.logger.error(`Error in scheduler run: ${error.message}`, error.stack);
      throw error;
    } finally {
      await this.redisService.releaseLock(this.lockKey, lockToken);
    }
  }

  private async markExpired(windowStart: Date): Promise<{
    expiredPublicationsCount: number;
    expiredPostsCount: number;
  }> {
    let expiredPublicationsCount = 0;
    let expiredPostsCount = 0;

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
        where: { id: { in: pubsToExpire.map(p => p.id) } },
        data: { status: PublicationStatus.EXPIRED },
      });
      expiredPublicationsCount = expiredPubs.count;

      if (expiredPubs.count > 0) {
        this.logger.log(`Marked ${expiredPubs.count} publications as EXPIRED`);

        // Notify creators of expired publications
        for (const pub of pubsToExpire) {
          try {
            // We need to fetch the creator ID
            const fullPub = await this.prisma.publication.findUnique({
              where: { id: pub.id },
              select: { createdBy: true, title: true, content: true, projectId: true },
            });
            if (fullPub?.createdBy) {
              await this.notifications.create({
                userId: fullPub.createdBy,
                type: NotificationType.PUBLICATION_FAILED,
                title: 'Publication Expired',
                message: `Publication "${fullPub.title || (fullPub.content ? fullPub.content.substring(0, 30) : 'Untitled')}..." has expired`,
                meta: { publicationId: pub.id, projectId: fullPub.projectId },
              });
            }
          } catch (e: any) {
            this.logger.error(`Failed to notify about expired publication ${pub.id}: ${e.message}`);
          }
        }
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
        where: { id: { in: postsToExpire.map(p => p.id) } },
        data: {
          status: PostStatus.FAILED,
          errorMessage: 'EXPIRED',
        },
      });
      expiredPostsCount = expiredPosts.count;

      if (expiredPosts.count > 0) {
        this.logger.log(`Marked ${expiredPosts.count} posts as EXPIRED`);
      }
    }

    return {
      expiredPublicationsCount,
      expiredPostsCount,
    };
  }

  private async processScheduledPublications(now: Date): Promise<number> {
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
            OR: [{ scheduledAt: { lte: now } }, { posts: { some: { scheduledAt: { lte: now } } } }],
          },
        ],
      },
      select: { id: true, scheduledAt: true, createdAt: true },
      orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }],
    });

    if (publications.length === 0) return 0;

    this.logger.debug(`Found ${publications.length} publications to trigger`);
    let triggeredPublicationsCount = 0;

    // Sequential trigger to maintain strict delivery order
    // This is crucial for multi-part messages in the same channel
    for (const pub of publications) {
      const isTriggered = await this.triggerPublication(pub.id);
      if (isTriggered) {
        triggeredPublicationsCount += 1;
      }
    }

    return triggeredPublicationsCount;
  }

  private async triggerPublication(publicationId: string): Promise<boolean> {
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
        return true;
      }

      return false;
    } catch (error: any) {
      this.logger.error(`Failed to trigger publication ${publicationId}: ${error.message}`);
      return false;
    }
  }
}
