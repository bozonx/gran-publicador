import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SocialPostingService } from './social-posting.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PublicationSchedulerService } from './publication-scheduler.service.js';
import { PostSnapshotBuilderService } from './post-snapshot-builder.service.js';
import { PUBLICATIONS_QUEUE } from './publications.queue.js';
import { PublicationProcessor } from './publication.processor.js';
import { ShutdownModule } from '../../common/services/shutdown.module.js';

@Module({
  imports: [
    PrismaModule,
    ShutdownModule,
    BullModule.registerQueue({
      name: PUBLICATIONS_QUEUE,
    }),
  ],
  providers: [
    SocialPostingService,
    PublicationSchedulerService,
    PostSnapshotBuilderService,
    PublicationProcessor,
  ],
  exports: [SocialPostingService, PublicationSchedulerService, PostSnapshotBuilderService],
})
export class SocialPostingModule {}
