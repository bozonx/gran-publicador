import {
  Body,
  Controller,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtOrApiTokenGuard } from '../../common/guards/jwt-or-api-token.guard.js';
import { ProjectScopeGuard } from '../../common/guards/project-scope.guard.js';
import type { UnifiedAuthRequest } from '../../common/types/unified-auth-request.interface.js';
import { PublicationLlmChatDto } from './dto/index.js';
import { PublicationsService } from './publications.service.js';

@Controller('publications/:id/llm')
@UseGuards(JwtOrApiTokenGuard, ProjectScopeGuard)
export class PublicationsLlmController {
  constructor(private readonly publicationsService: PublicationsService) {}

  /**
   * Chat with LLM for a publication.
   * POST /api/v1/publications/:id/llm/chat
   */
  @Post('chat')
  public async llmChat(
    @Request() req: UnifiedAuthRequest,
    @Param('id') id: string,
    @Body() dto: PublicationLlmChatDto,
  ) {
    const controller = new AbortController();
    const rawReq: any = (req as any).raw ?? (req as any).req ?? req;

    // Use a unified way to handle abort
    const onAbort = () => controller.abort();
    rawReq?.on?.('aborted', onAbort);
    rawReq?.on?.('close', onAbort);

    try {
      return await this.publicationsService.chatWithLlm(id, req.user.userId, dto, {
        signal: controller.signal,
      });
    } finally {
      rawReq?.off?.('aborted', onAbort);
      rawReq?.off?.('close', onAbort);
    }
  }
}
