import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';
import { ApiTokenGuard } from '../../common/guards/api-token.guard.js';
import { ApiTokensController } from './api-tokens.controller.js';
import { ApiTokensService } from './api-tokens.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [ApiTokensController],
  providers: [ApiTokensService, ApiTokenGuard],
  exports: [ApiTokensService, ApiTokenGuard],
})
export class ApiTokensModule {}
