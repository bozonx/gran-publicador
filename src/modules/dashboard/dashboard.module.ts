import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';
import { PublicationsModule } from '../publications/publications.module.js';
import { ContentLibraryModule } from '../content-library/content-library.module.js';
import { ChannelsModule } from '../channels/channels.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule, ProjectsModule, PublicationsModule, ContentLibraryModule, ChannelsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
