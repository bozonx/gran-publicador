import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  Request,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { ApiTokenGuard } from '../../common/guards/api-token.guard.js';
import { ApiTokenRequest } from '../../common/types/api-token-user.interface.js';
import { ExternalVfsService } from './services/external-vfs.service.js';
import { ExternalProxyService } from './services/external-proxy.service.js';
import { VfsListQueryDto, VfsSearchQueryDto } from './dto/vfs.dto.js';
import type { UnifiedAuthRequest } from '../../common/types/unified-auth-request.interface.js';

@Controller('external')
@UseGuards(ApiTokenGuard)
export class ExternalApiController {
  constructor(
    private readonly vfsService: ExternalVfsService,
    private readonly proxyService: ExternalProxyService,
  ) {}

  @Get('vfs/list')
  async list(@Request() req: ApiTokenRequest, @Query() query: VfsListQueryDto) {
    return this.vfsService.list(
      req.user.userId,
      query.path,
      req.user.projectIds,
      req.user.allProjects,
    );
  }

  @Get('vfs/search')
  async search(@Request() req: ApiTokenRequest, @Query() query: VfsSearchQueryDto) {
    return this.vfsService.search(
      req.user.userId,
      query.query,
      query.tags || [],
      req.user.projectIds,
      req.user.allProjects,
    );
  }

  @Post('vfs/upload')
  async upload(@Request() req: UnifiedAuthRequest) {
    if (!req.isMultipart?.()) {
      throw new BadRequestException('Request is not multipart');
    }

    const part = await req.file();
    if (!part) {
      throw new BadRequestException('No file uploaded');
    }

    const fields = (part as any).fields;
    const collectionId = fields?.collectionId?.value;
    const projectId = fields?.projectId?.value;

    if (!collectionId) {
      throw new BadRequestException('collectionId is required');
    }

    return this.vfsService.upload(req.user.userId, part, collectionId, projectId);
  }

  @Post('stt/transcribe')
  async transcribe(@Request() req: UnifiedAuthRequest) {
    if (!req.isMultipart?.()) {
      throw new BadRequestException('Request is not multipart');
    }

    const part = await req.file();
    if (!part) {
      throw new BadRequestException('No file uploaded');
    }

    const fields = (part as any).fields;
    const language = fields?.language?.value;

    const buffer = await part.toBuffer();

    return this.proxyService.transcribe({
      file: buffer,
      filename: part.filename,
      mimetype: part.mimetype,
      language,
    });
  }

  @Post('llm/chat')
  async chat(@Request() req: UnifiedAuthRequest, @Body() body: any) {
    const { messages, ...options } = body;
    return this.proxyService.chat(messages, options);
  }
}
