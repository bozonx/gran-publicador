import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from '../prisma/prisma.module.js';
import { ApiTokensModule } from '../api-tokens/api-tokens.module.js';
import { TagsModule } from '../tags/tags.module.js';
import { PublicationsModule } from '../publications/publications.module.js';
import { ContentLibraryController } from './content-library.controller.js';
import { ContentCollectionsService } from './content-collections.service.js';
import { ContentItemsService } from './content-items.service.js';
import { ContentLibraryService } from './content-library.service.js';
import { UnsplashService } from './unsplash.service.js';
import { ContentBulkService } from './content-bulk.service.js';
import { ContentLibraryVirtualService } from './content-library-virtual.service.js';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    ApiTokensModule,
    TagsModule,
    forwardRef(() => PublicationsModule),
  ],
  controllers: [ContentLibraryController],
  providers: [
    ContentCollectionsService,
    ContentItemsService,
    ContentLibraryService,
    UnsplashService,
    ContentBulkService,
    ContentLibraryVirtualService,
  ],
  exports: [
    ContentCollectionsService,
    ContentItemsService,
    ContentLibraryService,
    UnsplashService,
    ContentBulkService,
    ContentLibraryVirtualService,
  ],
})
export class ContentLibraryModule {}
