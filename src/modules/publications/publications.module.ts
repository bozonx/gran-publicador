import { Module, forwardRef } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';
import { ApiTokensModule } from '../api-tokens/api-tokens.module.js';
import { SocialPostingModule } from '../social-posting/social-posting.module.js';
import { LlmModule } from '../llm/llm.module.js';
import { TagsModule } from '../tags/tags.module.js';
import { ContentLibraryModule } from '../content-library/content-library.module.js';
import { PublicationsController } from './publications.controller.js';
import { PublicationsLlmController } from './publications-llm.controller.js';
import { PublicationsService } from './publications.service.js';

import { PublicationsLlmService } from './publications-llm.service.js';
import { PublicationsMapper } from './publications.mapper.js';
import { PublicationsMediaService } from './publications-media.service.js';
import { PublicationsBulkService } from './publications-bulk.service.js';
import { AuthorSignaturesModule } from '../author-signatures/author-signatures.module.js';

@Module({
  imports: [
    PrismaModule,
    ApiTokensModule,
    SocialPostingModule,
    LlmModule,
    TagsModule,
    forwardRef(() => ContentLibraryModule),
    AuthorSignaturesModule,
  ],
  controllers: [PublicationsController, PublicationsLlmController],
  providers: [
    PublicationsService,
    PublicationsLlmService,
    PublicationsMapper,
    PublicationsMediaService,
    PublicationsBulkService,
  ],
  exports: [
    PublicationsService,
    PublicationsLlmService,
    PublicationsMapper,
    PublicationsMediaService,
    PublicationsBulkService,
  ],
})
export class PublicationsModule {}
