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

import { JwtOrApiTokenGuard } from '../../common/guards/jwt-or-api-token.guard.js';
import { ProjectScopeGuard } from '../../common/guards/project-scope.guard.js';
import { CheckProjectScope } from '../../common/decorators/project-scope.decorator.js';
import type { UnifiedAuthRequest } from '../../common/types/unified-auth-request.interface.js';
import { ApiTokenScopeService } from '../../common/services/api-token-scope.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ContentCollectionsService } from './content-collections.service.js';
import { ContentItemsService } from './content-items.service.js';
import { PublicationsService } from '../publications/publications.service.js';
import { UnsplashService } from './unsplash.service.js';
import { ContentBulkService } from './content-bulk.service.js';
import { ContentLibraryVirtualService } from './content-library-virtual.service.js';
import { ContentCollectionType } from '../../generated/prisma/index.js';
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
@UseGuards(JwtOrApiTokenGuard, ProjectScopeGuard)
export class ContentLibraryController {
  constructor(
    private readonly collectionsService: ContentCollectionsService,
    private readonly itemsService: ContentItemsService,
    private readonly publicationsService: PublicationsService,
    private readonly unsplashService: UnsplashService,
    private readonly bulkService: ContentBulkService,
    private readonly virtualService: ContentLibraryVirtualService,
    private readonly prisma: PrismaService,
    private readonly apiTokenScope: ApiTokenScopeService,
  ) {}

  @Get('items')
  @CheckProjectScope()
  public async findAll(
    @Request() req: UnifiedAuthRequest,
    @Query() query: FindContentItemsQueryDto,
  ) {
    return this.itemsService.findAll(query, req.user.userId);
  }

  @Get('collections/:id/items')
  @CheckProjectScope()
  public async listCollectionItems(
    @Request() req: UnifiedAuthRequest,
    @Param('id') collectionId: string,
    @Query() query: FindContentItemsQueryDto,
  ) {
    const {
      scope,
      projectId,
      search,
      tags,
      sortBy,
      sortOrder,
      limit = 20,
      offset = 0,
      orphansOnly,
      withMedia,
    } = query;

    const collection = await this.collectionsService.assertCollectionAccess({
      collectionId,
      scope,
      projectId,
      userId: req.user.userId,
    });

    if (collection.type === ContentCollectionType.PUBLICATION_MEDIA_VIRTUAL) {
      return this.virtualService.listPublicationItems({
        scope,
        projectId,
        userId: req.user.userId,
        search,
        tags: tags?.join(','),
        sortBy,
        sortOrder,
        limit,
        offset,
        withMedia,
      });
    }

    if (collection.type === ContentCollectionType.UNSPLASH) {
      return this.virtualService.listUnsplashItems({
        search,
        limit,
        offset,
      });
    }

    const itemsQuery: FindContentItemsQueryDto = {
      ...query,
      groupIds: collection.type === ContentCollectionType.GROUP ? [collection.id] : undefined,
      orphansOnly: collection.type === ContentCollectionType.SAVED_VIEW ? orphansOnly : undefined,
      includeTotalInScope: true,
      includeTotalUnfiltered: true,
    };

    return this.itemsService.findAll(itemsQuery, req.user.userId);
  }

  @Get('collections')
  @CheckProjectScope()
  public async listCollections(
    @Request() req: UnifiedAuthRequest,
    @Query() query: FindContentCollectionsQueryDto,
  ) {
    return this.collectionsService.listCollections(query, req.user.userId);
  }

  @Post('collections')
  @CheckProjectScope({ source: 'body' })
  public async createCollection(
    @Request() req: UnifiedAuthRequest,
    @Body() dto: CreateContentCollectionDto,
  ) {
    return this.collectionsService.createCollection(dto, req.user.userId);
  }

  @Patch('collections/:id')
  @CheckProjectScope({ source: 'body' })
  public async updateCollection(
    @Request() req: UnifiedAuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateContentCollectionDto,
  ) {
    return this.collectionsService.updateCollection(
      id,
      {
        scope: dto.scope,
        projectId: dto.projectId,
        parentId: dto.parentId,
        title: dto.title,
        config: dto.config,
        version: dto.version,
      },
      req.user.userId,
    );
  }

  @Delete('collections/:id')
  @CheckProjectScope()
  public async deleteCollection(
    @Request() req: UnifiedAuthRequest,
    @Param('id') collectionId: string,
    @Query() query: FindContentCollectionsQueryDto,
  ) {
    return this.collectionsService.deleteCollection(collectionId, query, req.user.userId);
  }

  @Patch('collections/reorder')
  @CheckProjectScope({ source: 'body' })
  public async reorderCollections(
    @Request() req: UnifiedAuthRequest,
    @Body() dto: ReorderContentCollectionsDto,
  ) {
    return this.collectionsService.reorderCollections(dto, req.user.userId);
  }

  @Get('tags')
  @CheckProjectScope()
  public async getTags(
    @Request() req: UnifiedAuthRequest,
    @Query('scope') scope: 'personal' | 'project',
    @Query('projectId') projectId?: string,
    @Query('groupId') groupId?: string,
  ) {
    return this.itemsService.getAvailableTags(scope, projectId, req.user.userId, groupId);
  }

  @Get('tags/search')
  @CheckProjectScope()
  public async searchTags(
    @Request() req: UnifiedAuthRequest,
    @Query('q') q: string,
    @Query('scope') scope: 'personal' | 'project',
    @Query('projectId') projectId: string | undefined,
    @Query('groupId') groupId?: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
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
  @CheckProjectScope({ source: 'body' })
  public async create(@Request() req: UnifiedAuthRequest, @Body() dto: CreateContentItemDto) {
    return this.itemsService.create(dto, req.user.userId);
  }

  @Get('items/:id')
  public async findOne(@Request() req: UnifiedAuthRequest, @Param('id') id: string) {
    return this.itemsService.findOne(id, req.user.userId);
  }

  @Patch('items/:id')
  public async update(
    @Request() req: UnifiedAuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateContentItemDto,
  ) {
    return this.itemsService.update(id, dto, req.user.userId);
  }

  @Post('items/:id/groups')
  @CheckProjectScope({ source: 'body' })
  public async linkItemToGroup(
    @Request() req: UnifiedAuthRequest,
    @Param('id') contentItemId: string,
    @Body() dto: LinkContentItemGroupDto,
  ) {
    return this.itemsService.linkItemToGroup(contentItemId, dto, req.user.userId);
  }

  @Delete('items/:id/groups/:collectionId')
  public async unlinkItemFromGroup(
    @Request() req: UnifiedAuthRequest,
    @Param('id') contentItemId: string,
    @Param('collectionId') collectionId: string,
  ) {
    return this.itemsService.unlinkItemFromGroup(contentItemId, collectionId, req.user.userId);
  }

  @Post('items/:id/archive')
  public async archive(@Request() req: UnifiedAuthRequest, @Param('id') id: string) {
    return this.itemsService.archive(id, req.user.userId);
  }

  @Post('items/:id/restore')
  public async restore(@Request() req: UnifiedAuthRequest, @Param('id') id: string) {
    return this.itemsService.restore(id, req.user.userId);
  }

  @Post('projects/:projectId/purge-archived')
  @CheckProjectScope({ param: 'projectId', source: 'params' })
  public async purgeArchivedByProject(
    @Request() req: UnifiedAuthRequest,
    @Param('projectId') projectId: string,
  ) {
    return this.itemsService.purgeArchivedByProject(projectId, req.user.userId);
  }

  @Post('personal/purge-archived')
  public async purgeArchivedPersonal(@Request() req: UnifiedAuthRequest) {
    return this.itemsService.purgeArchivedPersonal(req.user.userId);
  }

  @Post('bulk')
  @CheckProjectScope({ source: 'body' })
  public async bulkOperation(@Request() req: UnifiedAuthRequest, @Body() dto: BulkOperationDto) {
    return this.bulkService.bulkOperation(req.user.userId, dto);
  }

  @Delete('items/:id')
  public async remove(@Request() req: UnifiedAuthRequest, @Param('id') id: string) {
    return this.itemsService.remove(id, req.user.userId);
  }

  @Post('items/:id/sync')
  public async sync(
    @Request() req: UnifiedAuthRequest,
    @Param('id') contentItemId: string,
    @Body() dto: SyncContentItemDto,
  ) {
    return this.itemsService.sync(contentItemId, dto, req.user.userId);
  }

  @Get('unsplash/photos/:id')
  public async getUnsplashPhoto(@Param('id') id: string) {
    return this.unsplashService.getPhoto(id);
  }
}
