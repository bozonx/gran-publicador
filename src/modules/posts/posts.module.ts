import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';
import { ApiTokensModule } from '../api-tokens/api-tokens.module.js';
import { ChannelsModule } from '../channels/channels.module.js';
import { SocialPostingModule } from '../social-posting/social-posting.module.js';
import { PostsController } from './posts.controller.js';
import { PostsService } from './posts.service.js';

@Module({
  imports: [PrismaModule, ApiTokensModule, ChannelsModule, SocialPostingModule],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
