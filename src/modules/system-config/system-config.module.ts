import { Module } from '@nestjs/common';

import { UsersModule } from '../users/users.module.js';
import { SystemConfigController } from './system-config.controller.js';
import { SystemConfigService } from './system-config.service.js';

@Module({
  imports: [UsersModule],
  providers: [SystemConfigService],
  controllers: [SystemConfigController],
  exports: [SystemConfigService],
})
export class SystemConfigModule {}
