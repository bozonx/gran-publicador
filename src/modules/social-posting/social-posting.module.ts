import { Module } from '@nestjs/common';
import { SocialPostingService } from './social-posting.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PublicationSchedulerService } from './publication-scheduler.service.js';

@Module({
  imports: [PrismaModule],
  providers: [SocialPostingService, PublicationSchedulerService],
  exports: [SocialPostingService],
})
export class SocialPostingModule {}
