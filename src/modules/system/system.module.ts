import { Module } from '@nestjs/common';
import { SystemController } from './system.controller.js';
import { SocialPostingModule } from '../social-posting/social-posting.module.js';
import { NewsQueriesModule } from '../news-queries/news-queries.module.js';

@Module({
  imports: [SocialPostingModule, NewsQueriesModule],
  controllers: [SystemController],
})
export class SystemModule {}
