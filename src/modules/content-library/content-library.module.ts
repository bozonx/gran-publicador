import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';
import { ApiTokensModule } from '../api-tokens/api-tokens.module.js';
import { TagsModule } from '../tags/tags.module.js';
import { ContentLibraryController } from './content-library.controller.js';
import { ContentCollectionsService } from './content-collections.service.js';
import { ContentItemsService } from './content-items.service.js';
import { ContentLibraryService } from './content-library.service.js';

@Module({
  imports: [PrismaModule, ApiTokensModule, TagsModule],
  controllers: [ContentLibraryController],
  providers: [ContentCollectionsService, ContentItemsService, ContentLibraryService],
  exports: [ContentCollectionsService, ContentItemsService, ContentLibraryService],
})
export class ContentLibraryModule {}
