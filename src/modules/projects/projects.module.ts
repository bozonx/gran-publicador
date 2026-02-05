import { Module } from '@nestjs/common';

import { PermissionsModule } from '../../common/services/permissions.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ApiTokensModule } from '../api-tokens/api-tokens.module.js';
import { RolesModule } from '../roles/roles.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { ProjectsController } from './projects.controller.js';
import { ProjectsService } from './projects.service.js';

@Module({
  imports: [PermissionsModule, PrismaModule, ApiTokensModule, RolesModule, NotificationsModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
