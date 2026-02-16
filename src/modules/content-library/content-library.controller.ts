import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  DefaultValuePipe,
  ParseIntPipe,
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
import { ContentCollectionsService } from './content-collections.service.js';
import { ContentItemsService } from './content-items.service.js';
import {
  BulkOperationDto,
  CreateContentItemDto,
  CreateContentCollectionDto,
  FindContentItemsQueryDto,
  FindContentCollectionsQueryDto,
  LinkContentItemGroupDto,
  UpdateContentCollectionDto,
  ReorderContentCollectionsDto,
  UpdateContentItemDto,
  SyncContentItemDto,
} from './dto/index.js';

@Controller('content-library')
@UseGuards(JwtOrApiTokenGuard)
export class ContentLibraryController {
  constructor(
    private readonly collectionsService: ContentCollectionsService,
    private readonly itemsService: ContentItemsService,
    private readonly prisma: PrismaService,
  ) {}

  private validateQueryProjectScopeOrThrow(req: UnifiedAuthRequest, projectId?: string) {
    if (!projectId) {
      return;
    }

    if (req.user.allProjects === false && req.user.projectIds) {
      ApiTokenGuard.validateProjectScope(projectId, req.user.allProjects, req.user.projectIds, {
        userId: req.user.userId,
        tokenId: req.user.tokenId,
      });
    }
  }

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

  private async validateBulkContentItemsProjectScopeOrThrow(
    req: UnifiedAuthRequest,
    contentItemIds: string[],
  ) {
    if (req.user.allProjects !== false || !req.user.projectIds) {
      return;
    }

    if (!Array.isArray(contentItemIds) || contentItemIds.length === 0) {
      return;
    }

    const items = await this.prisma.contentItem.findMany({
      where: { id: { in: contentItemIds } },
      select: { projectId: true },
    });

    const projectIds = Array.from(
      new Set(
        (items ?? [])
          .map(i => i.projectId)
          .filter((p): p is string => typeof p === 'string' && p.length > 0),
      ),
    );

    for (const projectId of projectIds) {
      ApiTokenGuard.validateProjectScope(projectId, req.user.allProjects, req.user.projectIds, {
        userId: req.user.userId,
        tokenId: req.user.tokenId,
      });
    }
  }

  @Get('items')
  public async findAll(
    @Request() req: UnifiedAuthRequest,
    @Query() query: FindContentItemsQueryDto,
  ) {
    if (query.scope === 'project') {
      this.validateQueryProjectScopeOrThrow(req, query.projectId);
    }

    return this.itemsService.findAll(query, req.user.userId);
  }

  @Get('collections')
  public async listCollections(
    @Request() req: UnifiedAuthRequest,
    @Query() query: FindContentCollectionsQueryDto,
  ) {
    if (query.scope === 'project') {
      this.validateQueryProjectScopeOrThrow(req, query.projectId);
    }

    return this.collectionsService.listCollections(query, req.user.userId);
  }

  @Post('collections')
  public async createCollection(
    @Request() req: UnifiedAuthRequest,
    @Body() dto: CreateContentCollectionDto,
  ) {
    if (dto.scope === 'project') {
      this.validateQueryProjectScopeOrThrow(req, dto.projectId);
    }

    return this.collectionsService.createCollection(dto, req.user.userId);
  }

  @Patch('collections/:id')
  public async updateCollection(
    @Request() req: UnifiedAuthRequest,
    @Param('id') collectionId: string,
    @Body() dto: UpdateContentCollectionDto,
  ) {
    if (dto.scope === 'project') {
      this.validateQueryProjectScopeOrThrow(req, dto.projectId);
    }

    return this.collectionsService.updateCollection(collectionId, dto, req.user.userId);
  }

  @Delete('collections/:id')
  public async deleteCollection(
    @Request() req: UnifiedAuthRequest,
    @Param('id') collectionId: string,
    @Query() query: FindContentCollectionsQueryDto,
  ) {
    if (query.scope === 'project') {
      this.validateQueryProjectScopeOrThrow(req, query.projectId);
    }

    return this.collectionsService.deleteCollection(collectionId, query, req.user.userId);
  }

  @Patch('collections/reorder')
  public async reorderCollections(
    @Request() req: UnifiedAuthRequest,
    @Body() dto: ReorderContentCollectionsDto,
  ) {
    if (dto.scope === 'project') {
      this.validateQueryProjectScopeOrThrow(req, dto.projectId);
    }

    return this.collectionsService.reorderCollections(dto, req.user.userId);
  }

  @Get('tags')
  public async getTags(
    @Request() req: UnifiedAuthRequest,
    @Query('scope') scope: 'personal' | 'project',
    @Query('projectId') projectId?: string,
    @Query('groupId') groupId?: string,
  ) {
    if (scope === 'project') {
      this.validateQueryProjectScopeOrThrow(req, projectId);
    }

    return this.itemsService.getAvailableTags(scope, projectId, req.user.userId, groupId);
  }

  @Get('tags/search')
  public async searchTags(
    @Request() req: UnifiedAuthRequest,
    @Query('q') q: string,
    @Query('scope') scope: 'personal' | 'project',
    @Query('projectId') projectId: string | undefined,
    @Query('groupId') groupId?: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    if (scope === 'project') {
      this.validateQueryProjectScopeOrThrow(req, projectId);
    }

    const tags = await this.itemsService.searchAvailableTags(
      {
        q,
        scope,
        projectId,
        groupId,
        limit,
      },
      req.user.userId,
    );

    return (tags ?? []).map(name => ({ name }));
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

    return this.itemsService.create(dto, req.user.userId);
  }

  @Get('items/:id')
  public async findOne(@Request() req: UnifiedAuthRequest, @Param('id') id: string) {
    await this.validateContentItemProjectScopeOrThrow(req, id);
    return this.itemsService.findOne(id, req.user.userId);
  }

  @Patch('items/:id')
  public async update(
    @Request() req: UnifiedAuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateContentItemDto,
  ) {
    await this.validateContentItemProjectScopeOrThrow(req, id);
    return this.itemsService.update(id, dto, req.user.userId);
  }

  @Post('items/:id/groups')
  public async linkItemToGroup(
    @Request() req: UnifiedAuthRequest,
    @Param('id') contentItemId: string,
    @Body() dto: LinkContentItemGroupDto,
  ) {
    await this.validateContentItemProjectScopeOrThrow(req, contentItemId);

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

    return this.itemsService.linkItemToGroup(contentItemId, dto, req.user.userId);
  }

  @Post('items/:id/archive')
  public async archive(@Request() req: UnifiedAuthRequest, @Param('id') id: string) {
    await this.validateContentItemProjectScopeOrThrow(req, id);
    return this.itemsService.archive(id, req.user.userId);
  }

  @Post('items/:id/restore')
  public async restore(@Request() req: UnifiedAuthRequest, @Param('id') id: string) {
    await this.validateContentItemProjectScopeOrThrow(req, id);
    return this.itemsService.restore(id, req.user.userId);
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

    return this.itemsService.purgeArchivedByProject(projectId, req.user.userId);
  }

  @Post('personal/purge-archived')
  public async purgeArchivedPersonal(@Request() req: UnifiedAuthRequest) {
    return this.itemsService.purgeArchivedPersonal(req.user.userId);
  }

  @Post('bulk')
  public async bulkOperation(@Request() req: UnifiedAuthRequest, @Body() dto: BulkOperationDto) {
    await this.validateBulkContentItemsProjectScopeOrThrow(req, dto.ids);
    this.validateQueryProjectScopeOrThrow(req, dto.projectId);
    return this.itemsService.bulkOperation(req.user.userId, dto);
  }

  @Delete('items/:id')
  public async remove(@Request() req: UnifiedAuthRequest, @Param('id') id: string) {
    await this.validateContentItemProjectScopeOrThrow(req, id);
    return this.itemsService.remove(id, req.user.userId);
  }

  @Post('items/:id/sync')
  public async sync(
    @Request() req: UnifiedAuthRequest,
    @Param('id') contentItemId: string,
    @Body() dto: SyncContentItemDto,
  ) {
    await this.validateContentItemProjectScopeOrThrow(req, contentItemId);
    return this.itemsService.sync(contentItemId, dto, req.user.userId);
  }
}
