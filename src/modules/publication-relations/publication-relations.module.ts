import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';
import { ApiTokensModule } from '../api-tokens/api-tokens.module.js';
import { PublicationRelationsController } from './publication-relations.controller.js';
import { PublicationRelationsService } from './publication-relations.service.js';

@Module({
  imports: [PrismaModule, ApiTokensModule],
  controllers: [PublicationRelationsController],
  providers: [PublicationRelationsService],
  exports: [PublicationRelationsService],
})
export class PublicationRelationsModule {}
