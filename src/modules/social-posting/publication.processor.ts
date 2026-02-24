import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PUBLICATIONS_QUEUE, ProcessPostJobData } from './publications.queue.js';
import { SocialPostingService } from './social-posting.service.js';
import { ShutdownService } from '../../common/services/shutdown.service.js';

@Processor(PUBLICATIONS_QUEUE, {
  concurrency: process.env.BULL_CONCURRENCY ? parseInt(process.env.BULL_CONCURRENCY, 10) : 5,
  stalledInterval: process.env.BULL_STALLED_CHECK_INTERVAL
    ? parseInt(process.env.BULL_STALLED_CHECK_INTERVAL, 10)
    : 30000,
  lockDuration: process.env.BULL_LOCK_DURATION ? parseInt(process.env.BULL_LOCK_DURATION, 10) : 30000,
  maxStalledCount: process.env.BULL_MAX_STALLED_COUNT
    ? parseInt(process.env.BULL_MAX_STALLED_COUNT, 10)
    : 1,
})
export class PublicationProcessor extends WorkerHost {
  private readonly logger = new Logger(PublicationProcessor.name);

  constructor(
    private readonly socialPostingService: SocialPostingService,
    private readonly shutdownService: ShutdownService,
  ) {
    super();
  }

  public async process(job: Job<ProcessPostJobData>): Promise<void> {
    if (this.shutdownService.isShutdownInProgress()) {
      this.logger.warn(`Worker is shutting down. Delaying job ${String(job.id)}`);
      await job.moveToDelayed(Date.now() + 5000, job.token);
      return;
    }

    const { postId, force } = job.data;

    await job.log(`Processing post ${postId}`);
    this.logger.log(`Processing post job for ${postId} (force: ${String(force)})`);

    try {
      const result = await this.socialPostingService.executePreparedPost(postId);

      if (result.success) {
        await job.log(`Successfully processed post ${postId}`);
      } else {
        await job.log(`Failed processed post ${postId}: ${result.error}`);
        throw new Error(result.error);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(`Failed to process post ${postId}: ${error.message}`, error.stack);
        await job.log(`Error processing post ${postId}: ${error.message}`);
      } else {
        this.logger.error(`Failed to process post ${postId}: ${String(error)}`);
        await job.log(`Error processing post ${postId}: ${String(error)}`);
      }
      throw error;
    } finally {
      // Regardless of success/failure of this post, we check if all posts for the publication are done
      try {
        const post = await this.socialPostingService['prisma'].post.findUnique({
          where: { id: postId },
          select: { publicationId: true },
        });
        if (post) {
          await this.socialPostingService.checkAndUpdatePublicationStatus(post.publicationId);
        }
      } catch (err: any) {
        this.logger.error(
          `Failed to check publication status after post ${postId}: ${err.message}`,
        );
      }
    }
  }
}
