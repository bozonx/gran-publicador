import { Module } from '@nestjs/common';
import { MediaService } from './media.service.js';
import { MediaController } from './media.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PermissionsService } from '../../common/services/permissions.service.js';
import { ApiTokensModule } from '../api-tokens/api-tokens.module.js';

@Module({
  imports: [PrismaModule, ApiTokensModule],
  controllers: [MediaController],
  providers: [MediaService, PermissionsService],
  exports: [MediaService],
})
export class MediaModule {}
