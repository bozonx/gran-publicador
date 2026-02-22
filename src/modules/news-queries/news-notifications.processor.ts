import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NEWS_NOTIFICATIONS_QUEUE, ProcessNewsQueryJobData } from './news-notifications.queue.js';
import { NewsNotificationsScheduler } from './news-notifications.scheduler.js';

@Processor(NEWS_NOTIFICATIONS_QUEUE, {
  concurrency: 5,
})
export class NewsNotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NewsNotificationsProcessor.name);

  constructor(private readonly newsNotificationsScheduler: NewsNotificationsScheduler) {
    super();
  }

  public async process(job: Job<ProcessNewsQueryJobData>): Promise<void> {
    const { queryId } = job.data;
    await job.log(`Processing news query ${queryId}`);
    this.logger.log(`Processing news query job for ${queryId}`);

    try {
      await this.newsNotificationsScheduler.processQueryById(queryId);
      await job.log(`Successfully processed news query ${queryId}`);
    } catch (error: any) {
      this.logger.error(`Failed to process news query ${queryId}: ${error.message}`, error.stack);
      await job.log(`Error processing news query ${queryId}: ${error.message}`);
      throw error;
    }
  }
}
