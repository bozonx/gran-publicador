import { Module } from '@nestjs/common';
import { ApiTokensModule } from '../api-tokens/api-tokens.module.js';
import { ContentLibraryModule } from '../content-library/content-library.module.js';
import { SttModule } from '../stt/stt.module.js';
import { LlmModule } from '../llm/llm.module.js';
import { MediaModule } from '../media/media.module.js';
import { ExternalApiController } from './external-api.controller.js';
import { ExternalVfsService } from './services/external-vfs.service.js';
import { ExternalProxyService } from './services/external-proxy.service.js';

@Module({
  imports: [
    ApiTokensModule,
    ContentLibraryModule,
    SttModule,
    LlmModule,
    MediaModule,
  ],
  controllers: [ExternalApiController],
  providers: [ExternalVfsService, ExternalProxyService],
})
export class ExternalApiModule {}
