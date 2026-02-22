import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NewsQueriesService } from './news-queries.service.js';
import { NewsQueriesController } from './news-queries.controller.js';
import { GlobalNewsQueriesController } from './global-news-queries.controller.js';
import { NewsNotificationsScheduler } from './news-notifications.scheduler.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PermissionsService } from '../../common/services/permissions.service.js';
import { NEWS_NOTIFICATIONS_QUEUE } from './news-notifications.queue.js';
import { NewsNotificationsProcessor } from './news-notifications.processor.js';

@Module({
  imports: [
    PrismaModule,
    ProjectsModule,
    NotificationsModule,
    BullModule.registerQueue({
      name: NEWS_NOTIFICATIONS_QUEUE,
    }),
  ],
  controllers: [NewsQueriesController, GlobalNewsQueriesController],
  providers: [
    NewsQueriesService,
    NewsNotificationsScheduler,
    PermissionsService,
    NewsNotificationsProcessor,
  ],
  exports: [NewsQueriesService, NewsNotificationsScheduler],
})
export class NewsQueriesModule {}
