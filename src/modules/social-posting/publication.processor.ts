import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PUBLICATIONS_QUEUE, ProcessPublicationJobData } from './publications.queue.js';
import { SocialPostingService } from './social-posting.service.js';
import { ShutdownService } from '../../common/services/shutdown.service.js';

@Processor(PUBLICATIONS_QUEUE, {
  concurrency: 5,
})
export class PublicationProcessor extends WorkerHost {
  private readonly logger = new Logger(PublicationProcessor.name);

  constructor(
    private readonly socialPostingService: SocialPostingService,
    private readonly shutdownService: ShutdownService,
  ) {
    super();
  }

  public async process(job: Job<ProcessPublicationJobData>): Promise<void> {
    if (this.shutdownService.isShutdownInProgress()) {
      this.logger.warn(`Worker is shutting down. Delaying job ${String(job.id)}`);
      await job.moveToDelayed(Date.now() + 5000, job.token);
      return;
    }

    const { publicationId, force } = job.data;

    await job.log(`Processing publication ${publicationId}`);
    this.logger.log(`Processing publication job for ${publicationId} (force: ${String(force)})`);

    try {
      await this.socialPostingService.publishPublication(publicationId, {
        skipLock: true, // Lock is acquired by the scheduler before pushing to queue
        force,
      });
      await job.log(`Successfully processed publication ${publicationId}`);
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(
          `Failed to process publication ${publicationId}: ${error.message}`,
          error.stack,
        );
        await job.log(`Error processing publication ${publicationId}: ${error.message}`);
      } else {
        this.logger.error(`Failed to process publication ${publicationId}: ${String(error)}`);
        await job.log(`Error processing publication ${publicationId}: ${String(error)}`);
      }
      throw error;
    }
  }
}
