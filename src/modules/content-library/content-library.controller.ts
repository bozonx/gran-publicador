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
import { PublicationsService } from '../publications/publications.service.js';
import { UnsplashService } from './unsplash.service.js';
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
    private readonly publicationsService: PublicationsService,
    private readonly unsplashService: UnsplashService,
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

  @Get('collections/:id/items')
  public async listCollectionItems(
    @Request() req: UnifiedAuthRequest,
    @Param('id') collectionId: string,
    @Query('scope') scope: 'personal' | 'project',
    @Query('projectId') projectId?: string,
    @Query('search') search?: string,
    @Query('tags') tags?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset?: number,
    @Query('orphansOnly') orphansOnly?: string,
  ) {
    if (scope === 'project') {
      this.validateQueryProjectScopeOrThrow(req, projectId);
    }

    const collection = await this.collectionsService.assertCollectionAccess({
      collectionId,
      scope,
      projectId,
      userId: req.user.userId,
    });

    if ((collection.type as any) === 'PUBLICATION_MEDIA_VIRTUAL') {
      const parsedTags =
        typeof tags === 'string' && tags.length > 0 ? tags.split(',').filter(Boolean) : [];
      const sortField = sortBy === 'title' ? 'title' : 'chronology';

      const res =
        scope === 'project'
          ? await this.publicationsService.findAll(projectId as string, req.user.userId, {
              limit,
              offset,
              includeArchived: false,
              archivedOnly: false,
              search,
              sortBy: sortField,
              sortOrder,
              tags: parsedTags.length > 0 ? parsedTags : undefined,
            })
          : await this.publicationsService.findAllForUser(req.user.userId, {
              limit,
              offset,
              includeArchived: false,
              archivedOnly: false,
              search,
              sortBy: sortField,
              sortOrder,
              tags: parsedTags.length > 0 ? parsedTags : undefined,
            });

      const mappedItems = (res.items ?? []).map((p: any) => {
        const tagNames = Array.isArray(p.tags)
          ? p.tags
          : (p.tagObjects ?? []).map((t: any) => t.name).filter(Boolean);
        const media = Array.isArray(p.media)
          ? p.media
              .slice()
              .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
              .map((m: any, idx: number) => ({
                mediaId: m.mediaId ?? m.media?.id,
                hasSpoiler: m.hasSpoiler,
                order: m.order ?? idx,
                media: m.media,
              }))
          : [];

        return {
          id: p.id,
          title: p.title,
          text: p.content,
          tags: tagNames,
          createdAt: p.effectiveAt ?? p.createdAt,
          archivedAt: null,
          media,
          _virtual: {
            source: 'publication',
            publicationId: p.id,
          },
        };
      });

      return {
        items: mappedItems,
        total: res.total,
        totalUnfiltered: res.totalUnfiltered,
        limit,
        offset,
      };
    }

    if ((collection.type as any) === 'UNSPLASH') {
      const query = typeof search === 'string' ? search.trim() : '';
      const page = Math.floor((offset ?? 0) / (limit ?? 20)) + 1;

      const res = await this.unsplashService.searchPhotos({
        query,
        page,
        perPage: limit ?? 20,
        orderBy: 'relevant',
      });

      const mappedItems = res.items.map((photo) => {
        const title = photo.altDescription || photo.description || null;
        const note = photo.description;

        return {
          id: photo.id,
          title,
          text: null,
          note,
          tags: photo.tags.map((t) => t.title).filter(Boolean),
          createdAt: photo.createdAt,
          archivedAt: null,
          media: [
            {
              order: 0,
              hasSpoiler: false,
              media: {
                id: `unsplash-${photo.id}`,
                type: 'IMAGE',
                storageType: 'URL',
                storagePath: photo.urls.small,
                filename: `unsplash-${photo.id}.jpg`,
              },
            },
          ],
          _virtual: {
            source: 'unsplash',
            unsplashId: photo.id,
            unsplashUser: photo.user.name,
            unsplashUsername: photo.user.username,
            unsplashUserUrl: photo.user.links.html,
            unsplashUrl: photo.links.html,
            thumbUrl: photo.urls.small,
            regularUrl: photo.urls.regular,
            likes: (photo as any).likes,
            views: (photo as any).views,
            downloads: (photo as any).downloads,
          },
        };
      });

      return {
        items: mappedItems,
        total: res.total,
        totalUnfiltered: res.total,
        limit,
        offset,
      };
    }

    const query: FindContentItemsQueryDto = {
      scope,
      projectId,
      limit,
      offset,
      search,
      sortBy: sortBy === 'title' ? 'title' : 'createdAt',
      sortOrder,
      tags:
        typeof tags === 'string' && tags.length > 0 ? tags.split(',').filter(Boolean) : undefined,
      groupIds: (collection.type as any) === 'GROUP' ? [collection.id] : undefined,
      orphansOnly: (collection.type as any) === 'SAVED_VIEW' ? orphansOnly === 'true' : undefined,
      includeTotalInScope: true,
      includeTotalUnfiltered: true,
    } as any;

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
