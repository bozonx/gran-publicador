import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';

import { ApiTokenGuard } from '../../common/guards/api-token.guard.js';
import { JwtOrApiTokenGuard } from '../../common/guards/jwt-or-api-token.guard.js';
import type { UnifiedAuthRequest } from '../../common/types/unified-auth-request.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  AttachContentItemMediaDto,
  CreateContentItemDto,
  CreateContentTextDto,
  FindContentItemsQueryDto,
  ReorderContentItemMediaDto,
  ReorderContentTextsDto,
  UpdateContentItemDto,
  UpdateContentTextDto,
} from './dto/index.js';
import { ContentLibraryService } from './content-library.service.js';

@Controller('content-library')
@UseGuards(JwtOrApiTokenGuard)
export class ContentLibraryController {
  constructor(
    private readonly contentLibraryService: ContentLibraryService,
    private readonly prisma: PrismaService,
  ) {}

  private async validateContentItemProjectScopeOrThrow(
    req: UnifiedAuthRequest,
    contentItemId: string,
  ) {
    if (req.user.allProjects !== false || !req.user.projectIds) {
      return;
    }

    const item = await this.prisma.contentItem.findUnique({
      where: { id: contentItemId },
      select: { projectId: true },
    });

    if (!item?.projectId) {
      return;
    }

    ApiTokenGuard.validateProjectScope(item.projectId, req.user.allProjects, req.user.projectIds, {
      userId: req.user.userId,
      tokenId: req.user.tokenId,
    });
  }

  @Get('items')
  public async findAll(
    @Request() req: UnifiedAuthRequest,
    @Query() query: FindContentItemsQueryDto,
  ) {
    if (
      query.scope === 'project' &&
      query.projectId &&
      req.user.allProjects === false &&
      req.user.projectIds
    ) {
      ApiTokenGuard.validateProjectScope(
        query.projectId,
        req.user.allProjects,
        req.user.projectIds,
        {
          userId: req.user.userId,
          tokenId: req.user.tokenId,
        },
      );
    }

    return this.contentLibraryService.findAll(query, req.user.userId);
  }

  @Post('items')
  public async create(@Request() req: UnifiedAuthRequest, @Body() dto: CreateContentItemDto) {
    if (
      dto.scope === 'project' &&
      dto.projectId &&
      req.user.allProjects === false &&
      req.user.projectIds
    ) {
      ApiTokenGuard.validateProjectScope(dto.projectId, req.user.allProjects, req.user.projectIds, {
        userId: req.user.userId,
        tokenId: req.user.tokenId,
      });
    }

    return this.contentLibraryService.create(dto, req.user.userId);
  }

  @Get('items/:id')
  public async findOne(@Request() req: UnifiedAuthRequest, @Param('id') id: string) {
    await this.validateContentItemProjectScopeOrThrow(req, id);
    return this.contentLibraryService.findOne(id, req.user.userId);
  }

  @Patch('items/:id')
  public async update(
    @Request() req: UnifiedAuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateContentItemDto,
  ) {
    await this.validateContentItemProjectScopeOrThrow(req, id);
    return this.contentLibraryService.update(id, dto, req.user.userId);
  }

  @Post('items/:id/archive')
  public async archive(@Request() req: UnifiedAuthRequest, @Param('id') id: string) {
    await this.validateContentItemProjectScopeOrThrow(req, id);
    return this.contentLibraryService.archive(id, req.user.userId);
  }

  @Post('items/:id/restore')
  public async restore(@Request() req: UnifiedAuthRequest, @Param('id') id: string) {
    await this.validateContentItemProjectScopeOrThrow(req, id);
    return this.contentLibraryService.restore(id, req.user.userId);
  }

  @Post('projects/:projectId/purge-archived')
  public async purgeArchivedByProject(
    @Request() req: UnifiedAuthRequest,
    @Param('projectId') projectId: string,
  ) {
    if (req.user.allProjects === false && req.user.projectIds) {
      ApiTokenGuard.validateProjectScope(projectId, req.user.allProjects, req.user.projectIds, {
        userId: req.user.userId,
        tokenId: req.user.tokenId,
      });
    }

    return this.contentLibraryService.purgeArchivedByProject(projectId, req.user.userId);
  }

  @Delete('items/:id')
  public async remove(@Request() req: UnifiedAuthRequest, @Param('id') id: string) {
    await this.validateContentItemProjectScopeOrThrow(req, id);
    return this.contentLibraryService.remove(id, req.user.userId);
  }

  @Post('items/:id/texts')
  public async createText(
    @Request() req: UnifiedAuthRequest,
    @Param('id') contentItemId: string,
    @Body() dto: CreateContentTextDto,
  ) {
    await this.validateContentItemProjectScopeOrThrow(req, contentItemId);
    return this.contentLibraryService.createText(contentItemId, dto, req.user.userId);
  }

  @Patch('items/:id/texts/:textId')
  public async updateText(
    @Request() req: UnifiedAuthRequest,
    @Param('id') contentItemId: string,
    @Param('textId') textId: string,
    @Body() dto: UpdateContentTextDto,
  ) {
    await this.validateContentItemProjectScopeOrThrow(req, contentItemId);
    return this.contentLibraryService.updateText(contentItemId, textId, dto, req.user.userId);
  }

  @Delete('items/:id/texts/:textId')
  public async removeText(
    @Request() req: UnifiedAuthRequest,
    @Param('id') contentItemId: string,
    @Param('textId') textId: string,
  ) {
    await this.validateContentItemProjectScopeOrThrow(req, contentItemId);
    return this.contentLibraryService.removeText(contentItemId, textId, req.user.userId);
  }

  @Patch('items/:id/texts/reorder')
  public async reorderTexts(
    @Request() req: UnifiedAuthRequest,
    @Param('id') contentItemId: string,
    @Body() dto: ReorderContentTextsDto,
  ) {
    await this.validateContentItemProjectScopeOrThrow(req, contentItemId);
    return this.contentLibraryService.reorderTexts(contentItemId, dto, req.user.userId);
  }

  @Post('items/:id/media')
  public async attachMedia(
    @Request() req: UnifiedAuthRequest,
    @Param('id') contentItemId: string,
    @Body() dto: AttachContentItemMediaDto,
  ) {
    await this.validateContentItemProjectScopeOrThrow(req, contentItemId);
    return this.contentLibraryService.attachMedia(contentItemId, dto, req.user.userId);
  }

  @Delete('items/:id/media/:mediaLinkId')
  public async detachMedia(
    @Request() req: UnifiedAuthRequest,
    @Param('id') contentItemId: string,
    @Param('mediaLinkId') mediaLinkId: string,
  ) {
    await this.validateContentItemProjectScopeOrThrow(req, contentItemId);
    return this.contentLibraryService.detachMedia(contentItemId, mediaLinkId, req.user.userId);
  }

  @Patch('items/:id/media/reorder')
  public async reorderMedia(
    @Request() req: UnifiedAuthRequest,
    @Param('id') contentItemId: string,
    @Body() dto: ReorderContentItemMediaDto,
  ) {
    await this.validateContentItemProjectScopeOrThrow(req, contentItemId);
    return this.contentLibraryService.reorderMedia(contentItemId, dto, req.user.userId);
  }
}
