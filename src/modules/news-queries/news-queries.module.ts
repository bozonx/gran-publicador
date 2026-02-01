import { Module } from '@nestjs/common';
import { NewsQueriesService } from './news-queries.service.js';
import { NewsQueriesController } from './news-queries.controller.js';
import { GlobalNewsQueriesController } from './global-news-queries.controller.js';
import { NewsNotificationsScheduler } from './news-notifications.scheduler.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [PrismaModule, ProjectsModule, NotificationsModule],
  controllers: [NewsQueriesController, GlobalNewsQueriesController],
  providers: [NewsQueriesService, NewsNotificationsScheduler],
  exports: [NewsQueriesService, NewsNotificationsScheduler],
})
export class NewsQueriesModule {}
