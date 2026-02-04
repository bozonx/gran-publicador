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
  AttachContentBlockMediaDto,
  CreateContentItemDto,
  CreateContentBlockDto,
  FindContentItemsQueryDto,
  ReorderContentBlockMediaDto,
  ReorderContentBlocksDto,
  UpdateContentItemDto,
  UpdateContentBlockDto,
  BulkOperationDto,
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

  @Post('bulk')
  public async bulkOperation(
    @Request() req: UnifiedAuthRequest,
    @Body() dto: BulkOperationDto,
  ) {
    return this.contentLibraryService.bulkOperation(req.user.userId, dto);
  }

  @Delete('items/:id')
  public async remove(@Request() req: UnifiedAuthRequest, @Param('id') id: string) {
    await this.validateContentItemProjectScopeOrThrow(req, id);
    return this.contentLibraryService.remove(id, req.user.userId);
  }

  @Post('items/:id/blocks')
  public async createBlock(
    @Request() req: UnifiedAuthRequest,
    @Param('id') contentItemId: string,
    @Body() dto: CreateContentBlockDto,
  ) {
    await this.validateContentItemProjectScopeOrThrow(req, contentItemId);
    return this.contentLibraryService.createBlock(contentItemId, dto, req.user.userId);
  }

  @Patch('items/:id/blocks/:blockId')
  public async updateBlock(
    @Request() req: UnifiedAuthRequest,
    @Param('id') contentItemId: string,
    @Param('blockId') blockId: string,
    @Body() dto: UpdateContentBlockDto,
  ) {
    await this.validateContentItemProjectScopeOrThrow(req, contentItemId);
    return this.contentLibraryService.updateBlock(contentItemId, blockId, dto, req.user.userId);
  }

  @Delete('items/:id/blocks/:blockId')
  public async removeBlock(
    @Request() req: UnifiedAuthRequest,
    @Param('id') contentItemId: string,
    @Param('blockId') blockId: string,
  ) {
    await this.validateContentItemProjectScopeOrThrow(req, contentItemId);
    return this.contentLibraryService.removeBlock(contentItemId, blockId, req.user.userId);
  }

  @Patch('items/:id/blocks/reorder')
  public async reorderBlocks(
    @Request() req: UnifiedAuthRequest,
    @Param('id') contentItemId: string,
    @Body() dto: ReorderContentBlocksDto,
  ) {
    await this.validateContentItemProjectScopeOrThrow(req, contentItemId);
    return this.contentLibraryService.reorderBlocks(contentItemId, dto, req.user.userId);
  }

  @Post('items/:id/blocks/:blockId/media')
  public async attachBlockMedia(
    @Request() req: UnifiedAuthRequest,
    @Param('id') contentItemId: string,
    @Param('blockId') blockId: string,
    @Body() dto: AttachContentBlockMediaDto,
  ) {
    await this.validateContentItemProjectScopeOrThrow(req, contentItemId);
    return this.contentLibraryService.attachBlockMedia(
      contentItemId,
      blockId,
      dto,
      req.user.userId,
    );
  }

  @Delete('items/:id/blocks/:blockId/media/:mediaLinkId')
  public async detachBlockMedia(
    @Request() req: UnifiedAuthRequest,
    @Param('id') contentItemId: string,
    @Param('blockId') blockId: string,
    @Param('mediaLinkId') mediaLinkId: string,
  ) {
    await this.validateContentItemProjectScopeOrThrow(req, contentItemId);
    return this.contentLibraryService.detachBlockMedia(
      contentItemId,
      blockId,
      mediaLinkId,
      req.user.userId,
    );
  }

  @Patch('items/:id/blocks/:blockId/media/reorder')
  public async reorderBlockMedia(
    @Request() req: UnifiedAuthRequest,
    @Param('id') contentItemId: string,
    @Param('blockId') blockId: string,
    @Body() dto: ReorderContentBlockMediaDto,
  ) {
    await this.validateContentItemProjectScopeOrThrow(req, contentItemId);
    return this.contentLibraryService.reorderBlockMedia(
      contentItemId,
      blockId,
      dto,
      req.user.userId,
    );
  }

  @Post('items/:id/blocks/:blockId/detach')
  public async detachBlock(
    @Request() req: UnifiedAuthRequest,
    @Param('id') contentItemId: string,
    @Param('blockId') blockId: string,
  ) {
    await this.validateContentItemProjectScopeOrThrow(req, contentItemId);
    return this.contentLibraryService.detachBlock(contentItemId, blockId, req.user.userId);
  }

  @Post('items/:id/blocks/:blockId/media/:mediaLinkId/copy-to-item')
  public async copyMediaToItem(
    @Request() req: UnifiedAuthRequest,
    @Param('id') contentItemId: string,
    @Param('blockId') blockId: string,
    @Param('mediaLinkId') mediaLinkId: string,
  ) {
    await this.validateContentItemProjectScopeOrThrow(req, contentItemId);
    return this.contentLibraryService.copyMediaToItem(
      contentItemId,
      blockId,
      mediaLinkId,
      req.user.userId,
    );
  }
}
