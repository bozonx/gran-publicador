import { Module } from '@nestjs/common';
import { SystemController } from './system.controller.js';
import { SocialPostingModule } from '../social-posting/social-posting.module.js';
import { NewsQueriesModule } from '../news-queries/news-queries.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { UsersModule } from '../users/users.module.js';
import { LocalNetworkGuard } from '../../common/guards/local-network.guard.js';
import { SystemAuthGuard } from '../../common/guards/system-auth.guard.js';
import { SystemOrAdminGuard } from './system-or-admin.guard.js';

@Module({
  imports: [SocialPostingModule, NewsQueriesModule, NotificationsModule, UsersModule],
  controllers: [SystemController],
  providers: [LocalNetworkGuard, SystemAuthGuard, SystemOrAdminGuard],
})
export class SystemModule {}
