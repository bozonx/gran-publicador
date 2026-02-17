import { Module, forwardRef } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';
import { ApiTokensModule } from '../api-tokens/api-tokens.module.js';
import { SocialPostingModule } from '../social-posting/social-posting.module.js';
import { LlmModule } from '../llm/llm.module.js';
import { TagsModule } from '../tags/tags.module.js';
import { ContentLibraryModule } from '../content-library/content-library.module.js';
import { PublicationsController } from './publications.controller.js';
import { PublicationsService } from './publications.service.js';

@Module({
  imports: [
    PrismaModule,
    ApiTokensModule,
    SocialPostingModule,
    LlmModule,
    TagsModule,
    forwardRef(() => ContentLibraryModule),
  ],
  controllers: [PublicationsController],
  providers: [PublicationsService],
  exports: [PublicationsService],
})
export class PublicationsModule {}
