import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Query,
  UseGuards,
  Request,
  Body,
  Param,
  Res,
  BadRequestException,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ApiTokenGuard } from '../../common/guards/api-token.guard.js';
import { JwtOrApiTokenGuard } from '../../common/guards/jwt-or-api-token.guard.js';
import { ApiTokenRequest } from '../../common/types/api-token-user.interface.js';
import { ExternalVfsService } from './services/external-vfs.service.js';
import { ExternalProxyService } from './services/external-proxy.service.js';
import {
  VfsListQueryDto,
  VfsSearchQueryDto,
  VfsCreateCollectionDto,
  VfsUpdateCollectionDto,
  VfsUpdateItemDto,
} from './dto/vfs.dto.js';
import { ScopesGuard } from '../../common/guards/scopes.guard.js';
import { RequireScopes } from '../../common/decorators/require-scopes.decorator.js';
import type { UnifiedAuthRequest } from '../../common/types/unified-auth-request.interface.js';

@Controller('external')
@UseGuards(JwtOrApiTokenGuard, ScopesGuard)
export class ExternalApiController {
  constructor(
    private readonly vfsService: ExternalVfsService,
    private readonly proxyService: ExternalProxyService,
  ) {}
  
  /**
   * Health check and token verification endpoint.
   * Returns information about the authorized token and user.
   */
  @Get('health')
  async health(@Request() req: ApiTokenRequest) {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      user: {
        id: req.user.userId,
      },
      token: {
        id: req.user.tokenId,
        name: req.user.name,
        scopes: req.user.scopes || [],
        allProjects: req.user.allProjects,
        projectIds: req.user.projectIds || [],
      }
    };
  }

  @Get('vfs/list')
  @RequireScopes('vfs:read')
  async list(@Request() req: ApiTokenRequest, @Query() query: VfsListQueryDto) {
    return this.vfsService.list(
      req.user.userId,
      query.path,
      req.user.projectIds || [],
      req.user.allProjects || false,
      query.limit,
      query.offset,
    );
  }

  @Get('vfs/search')
  @RequireScopes('vfs:read')
  async search(@Request() req: ApiTokenRequest, @Query() query: VfsSearchQueryDto) {
    return this.vfsService.search(
      req.user.userId,
      query.query,
      query.tags || [],
      req.user.projectIds || [],
      req.user.allProjects || false,
      query.limit,
      query.offset,
      query.type,
    );
  }

  @Post('vfs/upload')
  @RequireScopes('vfs:write')
  async upload(@Request() req: UnifiedAuthRequest) {
    if (!req.isMultipart?.()) {
      throw new BadRequestException('Request is not multipart');
    }

    const part = await req.file();
    if (!part) {
      throw new BadRequestException('No file uploaded');
    }

    const fields: any = (part as any).fields;
    const collectionId = fields?.collectionId?.value;
    const projectId = fields?.projectId?.value;

    if (!collectionId) {
      throw new BadRequestException('collectionId is required');
    }

    // Validate project scope if provided
    if (projectId) {
      ApiTokenGuard.validateProjectScope(
        projectId,
        req.user.allProjects || false,
        req.user.projectIds || [],
        { userId: req.user.userId, tokenId: req.user.tokenId },
      );
    }

    return this.vfsService.upload(
      req.user.userId,
      part,
      collectionId,
      projectId,
      req.user.projectIds,
      req.user.allProjects,
    );
  }

  @Post('vfs/collections')
  @RequireScopes('vfs:write')
  async createCollection(@Request() req: ApiTokenRequest, @Body() dto: VfsCreateCollectionDto) {
    return this.vfsService.createCollection(
      req.user.userId,
      dto.name,
      dto.parentId,
      req.user.projectIds,
      req.user.allProjects,
    );
  }

  @Patch('vfs/collections/:id')
  @RequireScopes('vfs:write')
  async updateCollection(
    @Request() req: ApiTokenRequest,
    @Param('id') id: string,
    @Body() dto: VfsUpdateCollectionDto,
  ) {
    return this.vfsService.updateCollection(req.user.userId, id, dto.name!);
  }

  @Delete('vfs/collections/:id')
  @RequireScopes('vfs:write')
  async deleteCollection(@Request() req: ApiTokenRequest, @Param('id') id: string) {
    return this.vfsService.deleteCollection(req.user.userId, id);
  }

  @Patch('vfs/items/:id')
  @RequireScopes('vfs:write')
  async updateItem(
    @Request() req: ApiTokenRequest,
    @Param('id') id: string,
    @Body() dto: VfsUpdateItemDto,
  ) {
    return this.vfsService.updateItem(req.user.userId, id, dto.name, dto.tags);
  }

  @Delete('vfs/items/:id')
  @RequireScopes('vfs:write')
  async deleteItem(@Request() req: ApiTokenRequest, @Param('id') id: string) {
    return this.vfsService.deleteItem(req.user.userId, id);
  }

  @Get('vfs/media/:id/thumbnail')
  @RequireScopes('vfs:read')
  async getThumbnail(
    @Param('id') id: string,
    @Request() req: UnifiedAuthRequest,
    @Res() res: FastifyReply,
    @Query('w') widthStr?: string,
    @Query('h') heightStr?: string,
    @Query('quality') qualityStr?: string,
  ) {
    const width = widthStr ? parseInt(widthStr, 10) : 400;
    const height = heightStr ? parseInt(heightStr, 10) : 400;
    const quality = qualityStr ? parseInt(qualityStr, 10) : undefined;
    const fit = (req.query as any)?.fit;

    const { stream, status, headers } = await this.vfsService.getThumbnail(
      id,
      width,
      height,
      quality,
      req.user.userId,
      fit,
    );

    res.status(status);
    res.headers(headers);
    return res.send(stream);
  }

  @Get('vfs/media/:id/file')
  @RequireScopes('vfs:read')
  async getFile(
    @Param('id') id: string,
    @Request() req: UnifiedAuthRequest,
    @Res() res: FastifyReply,
    @Query('download') download?: string,
  ) {
    const range = req.headers.range;
    const { stream, status, headers } = await this.vfsService.getFile(
      id,
      req.user.userId,
      range,
      download === '1' || download === 'true',
    );

    res.status(status);
    res.headers(headers);
    return res.send(stream);
  }

  @Post('stt/transcribe')
  @RequireScopes('stt:transcribe')
  async transcribe(@Request() req: UnifiedAuthRequest) {
    if (!req.isMultipart?.()) {
      throw new BadRequestException('Request is not multipart');
    }

    const part = await req.file();
    if (!part) {
      throw new BadRequestException('No file uploaded');
    }

    const fields: any = (part as any).fields;
    const language = fields?.language?.value;
    
    // Convert stream to buffer for STT service
    const buffer = await part.toBuffer();

    return this.proxyService.transcribe({
      file: buffer,
      filename: part.filename,
      mimetype: part.mimetype,
      language,
    });
  }

  @Post('llm/chat')
  @RequireScopes('llm:chat')
  async chat(@Request() req: UnifiedAuthRequest, @Body() body: any) {
    const { messages, ...options } = body;
    return this.proxyService.chat(messages, options);
  }
}
