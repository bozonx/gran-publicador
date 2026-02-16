import { Injectable } from '@nestjs/common';

import { BulkOperationDto, CreateContentItemDto, FindContentItemsQueryDto } from './dto/index.js';
import { ContentCollectionsService } from './content-collections.service.js';
import { ContentItemsService } from './content-items.service.js';

@Injectable()
export class ContentLibraryService {
  constructor(
    private readonly itemsService: ContentItemsService,
    private readonly collectionsService: ContentCollectionsService,
  ) {}

  public async assertGroupTabAccess(options: {
    groupId: string;
    scope: 'project' | 'personal';
    projectId?: string;
    userId: string;
  }) {
    return this.collectionsService.assertCollectionAccess({
      collectionId: options.groupId,
      scope: options.scope,
      projectId: options.projectId,
      userId: options.userId,
      expectedType: 'GROUP',
    } as any);
  }

  public async assertCollectionAccess(options: {
    collectionId: string;
    scope: 'personal' | 'project';
    projectId?: string;
    userId: string;
  }) {
    return this.collectionsService.assertCollectionAccess({
      collectionId: options.collectionId,
      scope: options.scope,
      projectId: options.projectId,
      userId: options.userId,
    } as any);
  }

  public async getAvailableTags(
    scope: 'project' | 'personal',
    projectId: string | undefined,
    userId: string,
    groupId?: string,
  ) {
    if (groupId) {
      await this.assertGroupTabAccess({
        groupId,
        scope,
        projectId,
        userId,
      });
    }
    return this.itemsService.getAvailableTags(scope, projectId, userId, groupId);
  }

  public async searchAvailableTags(
    query: {
      q: string;
      limit?: number;
      scope: 'personal' | 'project';
      projectId?: string;
      groupId?: string;
    },
    userId: string,
  ) {
    return this.itemsService.searchAvailableTags(query, userId);
  }

  public async bulkOperation(userId: string, dto: BulkOperationDto) {
    return this.itemsService.bulkOperation(userId, dto);
  }

  public async create(dto: CreateContentItemDto, userId: string) {
    return this.itemsService.create(dto, userId);
  }

  public async findAll(query: FindContentItemsQueryDto, userId: string) {
    return this.itemsService.findAll(query, userId);
  }

  public async findOne(id: string, userId: string) {
    return this.itemsService.findOne(id, userId);
  }

  public async listCollections(
    query: { scope: 'personal' | 'project'; projectId?: string },
    userId: string,
  ) {
    return this.collectionsService.listCollections(query, userId);
  }

  public async deleteCollection(
    collectionId: string,
    options: { scope: 'personal' | 'project'; projectId?: string },
    userId: string,
  ) {
    await this.assertCollectionAccess({
      collectionId,
      scope: options.scope,
      projectId: options.projectId,
      userId,
    });
    return this.collectionsService.deleteCollection(collectionId, options, userId);
  }

  public async reorderCollections(
    dto: { scope: 'personal' | 'project'; projectId?: string; ids: string[] },
    userId: string,
  ) {
    return this.collectionsService.reorderCollections(dto, userId);
  }

  public async archive(id: string, userId: string) {
    return this.itemsService.archive(id, userId);
  }

  public async restore(id: string, userId: string) {
    return this.itemsService.restore(id, userId);
  }

  public async purgeArchivedByProject(projectId: string, userId: string) {
    return this.itemsService.purgeArchivedByProject(projectId, userId);
  }
}
