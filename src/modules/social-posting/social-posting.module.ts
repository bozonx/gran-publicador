import { Module } from '@nestjs/common';
import { SocialPostingService } from './social-posting.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  providers: [SocialPostingService],
  exports: [SocialPostingService],
})
export class SocialPostingModule {}
