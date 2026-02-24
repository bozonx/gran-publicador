import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';
import { ApiTokensController } from './api-tokens.controller.js';
import { ApiTokensService } from './api-tokens.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [ApiTokensController],
  providers: [ApiTokensService],
  exports: [ApiTokensService],
})
export class ApiTokensModule {}
