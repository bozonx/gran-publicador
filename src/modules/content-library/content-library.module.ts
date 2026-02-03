import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';
import { ApiTokensModule } from '../api-tokens/api-tokens.module.js';
import { JwtOrApiTokenGuard } from '../../common/guards/jwt-or-api-token.guard.js';
import { ContentLibraryController } from './content-library.controller.js';
import { ContentLibraryService } from './content-library.service.js';

@Module({
  imports: [PrismaModule, ApiTokensModule],
  controllers: [ContentLibraryController],
  providers: [ContentLibraryService, JwtOrApiTokenGuard],
  exports: [ContentLibraryService],
})
export class ContentLibraryModule {}
