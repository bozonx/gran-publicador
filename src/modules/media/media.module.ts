import { Module } from '@nestjs/common';
import { MediaService } from './media.service.js';
import { MediaController } from './media.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PermissionsService } from '../../common/services/permissions.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [MediaController],
  providers: [MediaService, PermissionsService],
  exports: [MediaService],
})
export class MediaModule {}
