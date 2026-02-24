import { Module } from '@nestjs/common';

import { PermissionsModule } from '../../common/services/permissions.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ApiTokensModule } from '../api-tokens/api-tokens.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { SocialPostingModule } from '../social-posting/social-posting.module.js';
import { ChannelsController } from './channels.controller.js';
import { ChannelsService } from './channels.service.js';

import { ChannelsMapper } from './channels.mapper.js';

@Module({
  imports: [PermissionsModule, PrismaModule, ApiTokensModule, ProjectsModule, SocialPostingModule],
  controllers: [ChannelsController],
  providers: [ChannelsService, ChannelsMapper],
  exports: [ChannelsService, ChannelsMapper],
})
export class ChannelsModule {}
