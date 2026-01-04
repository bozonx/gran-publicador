import { Module } from '@nestjs/common';

import { PermissionsModule } from '../../common/services/permissions.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ApiTokensModule } from '../api-tokens/api-tokens.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { ChannelsController } from './channels.controller.js';
import { ChannelsService } from './channels.service.js';

@Module({
  imports: [PermissionsModule, PrismaModule, ApiTokensModule, ProjectsModule],
  controllers: [ChannelsController],
  providers: [ChannelsService],
  exports: [ChannelsService],
})
export class ChannelsModule {}
