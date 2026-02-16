import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { SystemRoleType } from '../../common/types/permissions.types.js';
import { PermissionsService } from '../../common/services/permissions.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TagsService } from '../tags/tags.service.js';
import {
  BulkOperationDto,
  CreateContentItemDto,
  FindContentItemsQueryDto,
  UpdateContentItemDto,
  BulkOperationType,
  SyncContentItemDto,
} from './dto/index.js';

const TEXT_MERGE_SEPARATOR = '\n\n---\n\n';

@Injectable()
export class ContentLibraryService {
  private readonly logger = new Logger(ContentLibraryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly tagsService: TagsService,
  ) {}

  private async withSerializableRetry<T>(operationName: string, fn: () => Promise<T>): Promise<T> {
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        const isRetryable =
          error?.code === 'P2034' ||
          (typeof error?.message === 'string' &&
            (error.message.includes('deadlock') || error.message.includes('could not serialize')));

        if (!isRetryable || attempt === maxRetries - 1) {
          throw error;
        }

        this.logger.warn(
          `Retrying serializable transaction for ${operationName} (attempt ${attempt + 2}/${maxRetries})`,
        );
      }
    }

    throw new Error(`Unreachable: serializable retry loop exhausted for ${operationName}`);
  }

  private normalizeSearchTokens(search: string): string[] {
    return search
      .split(/[,\s]+/)
      .map(t => t.trim())
      .filter(Boolean)
      .map(t => t.toLowerCase())
      .slice(0, 20);
  }

  private normalizeTags(tags?: string[]): string[] {
    if (!tags) return [];
    const normalized = tags
      .map(t => t.trim())
      .filter(Boolean)
      .map(t => t.toLowerCase())
      .slice(0, 50);
    return Array.from(new Set(normalized));
  }

  private ensureHasAnyContent(_input: { text?: unknown; mediaIds?: unknown[]; media?: unknown[] }) {
    // Validation disabled to allow creating empty items
  }

  private normalizeItemText(text?: unknown): string | null {
    if (typeof text !== 'string') return null;
    const trimmed = text.trim();
    return trimmed.length > 0 ? trimmed : '';
  }

  private mapIncomingMediaIds(dto: { mediaIds?: string[]; media?: Array<{ mediaId: string }> }) {
    if (dto.mediaIds) return dto.mediaIds;
    if (dto.media) return dto.media.map(m => m.mediaId);
    return undefined;
  }

  /**
   * Normalize tagObjects relation into a flat tags string array on a content item response.
   */
  private normalizeContentItemTags(item: any): any {
    if (!item) return item;
    return {
      ...item,
      tags: (item.tagObjects ?? []).map((t: any) => t.name).filter(Boolean),
    };
  }

  private async assertContentItemAccess(
    contentItemId: string,
    userId: string,
    allowArchived = true,
  ) {
    const item: any = await (this.prisma.contentItem as any).findUnique({
      where: { id: contentItemId },
      select: {
        id: true,
        userId: true,
        projectId: true,
        archivedAt: true,
        title: true,
      },
    });

    if (!item) {
      throw new NotFoundException('Content item not found');
    }

    if (!allowArchived && item.archivedAt) {
      throw new BadRequestException('Content item is archived');
    }

    if (item.projectId) {
      await this.permissions.checkProjectAccess(item.projectId, userId, true);
      return item;
    }

    if (item.userId !== userId) {
      throw new ForbiddenException('You do not have access to this content item');
    }

    return item;
  }

  private async assertGroupTabAccess(options: {
    groupId: string;
    scope: 'personal' | 'project';
    projectId?: string;
    userId: string;
  }) {
    const collection = await this.prisma.contentCollection.findUnique({
      where: { id: options.groupId },
      select: { id: true, type: true, groupType: true, userId: true, projectId: true },
    });

    if (!collection) {
      throw new NotFoundException('Group not found');
    }

    if ((collection.type as any) !== 'GROUP') {
      throw new BadRequestException('Tab is not a group');
    }

    const resolvedGroupType = this.resolveGroupType(collection);

    if (options.scope === 'personal') {
      if (resolvedGroupType !== 'PERSONAL_USER') {
        throw new ForbiddenException('You do not have access to this group');
      }
      if (collection.userId !== options.userId) {
        throw new ForbiddenException('You do not have access to this group');
      }
      return collection;
    }

    if (!options.projectId) {
      throw new BadRequestException('projectId is required for project scope');
    }

    if (collection.projectId !== options.projectId) {
      throw new ForbiddenException('Group does not belong to this project');
    }

    await this.permissions.checkProjectAccess(options.projectId, options.userId, true);

    if (resolvedGroupType === 'PROJECT_USER' && collection.userId !== options.userId) {
      throw new ForbiddenException('You do not have access to this group');
    }

    return collection;
  }

  private resolveGroupType(collection: {
    type: unknown;
    groupType?: unknown;
    userId: string | null;
    projectId: string | null;
  }): 'PERSONAL_USER' | 'PROJECT_USER' | 'PROJECT_SHARED' {
    if ((collection.type as any) !== 'GROUP') {
      throw new BadRequestException('Tab is not a group');
    }

    if (
      collection.groupType === 'PERSONAL_USER' ||
      collection.groupType === 'PROJECT_USER' ||
      collection.groupType === 'PROJECT_SHARED'
    ) {
      return collection.groupType;
    }

    // Backward compatibility for older records without groupType.
    if (collection.userId !== null && collection.projectId === null) {
      return 'PERSONAL_USER';
    }
    if (collection.userId === null && collection.projectId !== null) {
      return 'PROJECT_SHARED';
    }

    throw new BadRequestException('Invalid group scope configuration');
  }

  private async assertNotViewer(projectId: string, userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });
    if (user?.isAdmin) {
      return;
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        ownerId: true,
        members: {
          where: { userId },
          select: { role: { select: { systemType: true } } },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (project.ownerId === userId) {
      return;
    }
    if (project.members.length === 0) {
      throw new ForbiddenException('You do not have access to this project');
    }

    const roleSystemType = project.members[0]?.role?.systemType;
    if (roleSystemType === SystemRoleType.VIEWER) {
      throw new ForbiddenException('Viewers cannot perform this action');
    }
  }

  private async assertProjectOwnerOrAdmin(projectId: string, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });
    if (user?.isAdmin) {
      return;
    }
    await this.assertProjectOwner(projectId, userId);
  }

  private async assertCollectionAccess(options: {
    collectionId: string;
    scope: 'personal' | 'project';
    projectId?: string;
    userId: string;
    requireMutationPermission?: boolean;
  }) {
    const collection = await this.prisma.contentCollection.findUnique({
      where: { id: options.collectionId },
      select: {
        id: true,
        type: true,
        groupType: true,
        userId: true,
        projectId: true,
        parentId: true,
      },
    });

    if (!collection) {
      throw new NotFoundException('Tab not found');
    }

    if (options.scope === 'personal') {
      if (collection.projectId !== null || collection.userId !== options.userId) {
        throw new ForbiddenException('You do not have access to this collection');
      }

      if ((collection.type as any) === 'GROUP') {
        const groupType = this.resolveGroupType(collection);
        if (groupType !== 'PERSONAL_USER') {
          throw new ForbiddenException('You do not have access to this collection');
        }
      }
      return collection;
    }

    if (!options.projectId) {
      throw new BadRequestException('projectId is required for project scope');
    }

    if (collection.projectId !== options.projectId) {
      throw new ForbiddenException('Tab does not belong to this project');
    }

    await this.permissions.checkProjectAccess(options.projectId, options.userId, true);

    if ((collection.type as any) === 'SAVED_VIEW') {
      if (collection.userId !== options.userId) {
        throw new ForbiddenException('You do not have access to this collection');
      }
      if (options.requireMutationPermission) {
        await this.assertNotViewer(options.projectId, options.userId);
      }
      return collection;
    }

    const groupType = this.resolveGroupType(collection);
    if (groupType === 'PROJECT_USER' && collection.userId !== options.userId) {
      throw new ForbiddenException('You do not have access to this collection');
    }

    if (options.requireMutationPermission) {
      if (groupType === 'PROJECT_SHARED') {
        await this.assertProjectOwnerOrAdmin(options.projectId, options.userId);
      } else {
        await this.assertNotViewer(options.projectId, options.userId);
      }
    }

    return collection;
  }

  private async assertContentItemMutationAllowed(contentItemId: string, userId: string) {
    const item = await this.assertContentItemAccess(contentItemId, userId, true);

    if (item.projectId) {
      await this.permissions.checkProjectPermission(item.projectId, userId, ['ADMIN', 'EDITOR']);
    }

    return item;
  }

  private async assertProjectContentMutationAllowed(projectId: string, userId: string) {
    await this.permissions.checkProjectPermission(projectId, userId, ['ADMIN', 'EDITOR']);
  }

  private async assertProjectOwner(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (project.ownerId !== userId) {
      throw new ForbiddenException('Only project owner can perform this action');
    }
  }

  private async resolveParentGroupId(options: {
    parentId?: string | null;
    scope: 'personal' | 'project';
    projectId?: string;
    userId: string;
    childGroupType?: 'PERSONAL_USER' | 'PROJECT_USER' | 'PROJECT_SHARED';
  }): Promise<string | null | undefined> {
    if (options.parentId === undefined) {
      return undefined;
    }

    if (options.parentId === null) {
      return null;
    }

    const parent = await this.assertGroupTabAccess({
      groupId: options.parentId,
      scope: options.scope,
      projectId: options.projectId,
      userId: options.userId,
    });

    if (options.childGroupType) {
      const parentGroupType = this.resolveGroupType(parent as any);
      if (parentGroupType !== options.childGroupType) {
        throw new BadRequestException('Cannot mix group types in one hierarchy');
      }
    }

    return parent.id;
  }

  private async ensureNoTabCycle(options: { collectionId: string; parentId: string }) {
    const [res] = (await this.prisma.$queryRaw<Array<{ has_target: boolean; has_cycle: boolean }>>`
      WITH RECURSIVE parents AS (
        SELECT
          id,
          parent_id,
          ARRAY[id] AS path,
          FALSE AS cycle
        FROM content_collections
        WHERE id = ${options.parentId}::uuid

        UNION ALL

        SELECT
          c.id,
          c.parent_id,
          p.path || c.id,
          c.id = ANY(p.path) AS cycle
        FROM content_collections c
        JOIN parents p ON c.id = p.parent_id
        WHERE p.cycle = FALSE
      )
      SELECT
        EXISTS(SELECT 1 FROM parents WHERE id = ${options.collectionId}::uuid) AS has_target,
        EXISTS(SELECT 1 FROM parents WHERE cycle = TRUE) AS has_cycle
    `) as Array<{ has_target: boolean; has_cycle: boolean }>;

    if (res?.has_cycle) {
      throw new BadRequestException('Invalid group hierarchy');
    }

    if (res?.has_target) {
      throw new BadRequestException('Cannot move group into its descendant');
    }
  }

  private assertItemScopeMatches(options: {
    item: { projectId: string | null; userId: string | null };
    scope: 'personal' | 'project';
    projectId?: string;
  }) {
    if (options.item.projectId) {
      if (options.scope !== 'project') {
        throw new BadRequestException('Scope mismatch: item belongs to project scope');
      }
      if (!options.projectId || options.projectId !== options.item.projectId) {
        throw new BadRequestException('projectId does not match content item scope');
      }
      return;
    }

    if (options.scope !== 'personal') {
      throw new BadRequestException('Scope mismatch: item belongs to personal scope');
    }
  }

  public async findAll(query: FindContentItemsQueryDto, userId: string) {
    const limit = Math.min(query.limit ?? 20, 100);
    const offset = query.offset ?? 0;

    if (query.scope === 'project') {
      if (!query.projectId) {
        throw new BadRequestException('projectId is required for project scope');
      }
      await this.permissions.checkProjectAccess(query.projectId, userId, true);
    }

    const where: any = {};

    if (query.archivedOnly) {
      where.archivedAt = { not: null };
    } else if (!query.includeArchived) {
      where.archivedAt = null;
    }

    if (query.scope === 'personal') {
      where.userId = userId;
      where.projectId = null;
    } else {
      where.projectId = query.projectId;
    }

    if (query.groupId) {
      await this.assertGroupTabAccess({
        groupId: query.groupId,
        scope: query.scope,
        projectId: query.projectId,
        userId,
      });
      where.groups = { some: { collectionId: query.groupId } };
    }

    if (query.tags && query.tags.length > 0) {
      where.tagObjects = { some: { normalizedName: { in: query.tags.map(t => t.toLowerCase()) } } };
    }

    if (query.search) {
      const tagTokens = this.normalizeSearchTokens(query.search);
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { note: { contains: query.search, mode: 'insensitive' } },
        { text: { contains: query.search, mode: 'insensitive' } },
        ...(tagTokens.length > 0
          ? ([
              {
                tagObjects: {
                  some: { normalizedName: { in: tagTokens.map(t => t.toLowerCase()) } },
                },
              },
            ] as any)
          : []),
      ];
    }

    const includeMedia = query.includeMedia !== false;

    const shouldIncludeTotalUnfiltered =
      query.includeTotalUnfiltered === true ||
      (query.includeTotalUnfiltered === undefined && offset === 0);

    const baseQueries: Array<Promise<any>> = [
      this.prisma.contentItem.findMany({
        where,
        orderBy: { [query.sortBy ?? 'createdAt']: query.sortOrder ?? 'desc' },
        take: limit,
        skip: offset,
        include: {
          tagObjects: true,
          ...(includeMedia
            ? {
                media: {
                  orderBy: { order: 'asc' },
                  include: { media: true },
                },
              }
            : {}),
        },
      }),
      this.prisma.contentItem.count({ where }),
    ];

    if (shouldIncludeTotalUnfiltered) {
      baseQueries.push(
        this.prisma.contentItem.count({
          where: {
            userId: query.scope === 'personal' ? userId : undefined,
            projectId: query.scope === 'project' ? query.projectId : undefined,
            archivedAt: null,
            ...(query.groupId
              ? {
                  groups: { some: { collectionId: query.groupId } },
                }
              : {}),
          } as any,
        }),
      );
    }

    const [items, total, totalUnfiltered] = (await Promise.all(baseQueries)) as [
      any[],
      number,
      number | undefined,
    ];

    return {
      items: items.map((item: any) => this.normalizeContentItemTags(item)),
      total,
      totalUnfiltered,
      limit,
      offset,
    };
  }

  public async findOne(id: string, userId: string) {
    await this.assertContentItemAccess(id, userId, true);

    const item = await this.prisma.contentItem.findUnique({
      where: { id },
      include: {
        tagObjects: true,
        media: {
          orderBy: { order: 'asc' },
          include: { media: true },
        },
      },
    });

    return this.normalizeContentItemTags(item);
  }

  public async remove(id: string, userId: string) {
    await this.assertContentItemMutationAllowed(id, userId);

    return this.prisma.contentItem.delete({
      where: { id },
    });
  }

  public async create(dto: CreateContentItemDto, userId: string) {
    this.ensureHasAnyContent({ text: dto.text, media: dto.media });

    if (dto.scope === 'project') {
      if (!dto.projectId) {
        throw new BadRequestException('projectId is required for project scope');
      }
      await this.assertProjectContentMutationAllowed(dto.projectId, userId);
    }

    if (dto.groupId) {
      await this.assertGroupTabAccess({
        groupId: dto.groupId,
        scope: dto.scope,
        projectId: dto.projectId,
        userId,
      });
    }

    const created = await (this.prisma.contentItem as any).create({
      data: {
        userId: dto.scope === 'personal' ? userId : null,
        projectId: dto.scope === 'project' ? dto.projectId! : null,
        groups: dto.groupId
          ? {
              create: [{ collectionId: dto.groupId }],
            }
          : undefined,
        title: dto.title,
        tagObjects: await this.tagsService.prepareTagsConnectOrCreate(
          dto.tags ?? [],
          {
            projectId: dto.scope === 'project' ? dto.projectId : undefined,
            userId: dto.scope === 'personal' ? userId : undefined,
          },
          'CONTENT_LIBRARY',
        ),
        note: dto.note,
        text: this.normalizeItemText(dto.text),
        meta: (dto.meta ?? {}) as any,
        media: dto.media
          ? {
              create: dto.media
                .slice()
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                .map((m, idx) => ({
                  mediaId: m.mediaId,
                  order: m.order ?? idx,
                  hasSpoiler: !!m.hasSpoiler,
                })),
            }
          : undefined,
      },
      include: {
        tagObjects: true,
        media: {
          orderBy: { order: 'asc' },
          include: { media: true },
        },
      },
    });

    return this.normalizeContentItemTags(created);
  }

  public async update(id: string, dto: UpdateContentItemDto, userId: string) {
    const item = await this.assertContentItemMutationAllowed(id, userId);

    if (dto.groupId !== undefined && dto.groupId !== null) {
      if (dto.groupId) {
        await this.assertGroupTabAccess({
          groupId: dto.groupId,
          scope: item.projectId ? 'project' : 'personal',
          projectId: item.projectId ?? undefined,
          userId,
        });
      }
    }

    const updated = await this.prisma.$transaction(async tx => {
      if (dto.groupId !== undefined) {
        if (dto.groupId === null) {
          await (tx as any).contentItemGroup.deleteMany({ where: { contentItemId: id } });
        } else {
          await (tx as any).contentItemGroup.upsert({
            where: {
              contentItemId_collectionId: {
                contentItemId: id,
                collectionId: dto.groupId,
              },
            },
            create: {
              contentItemId: id,
              collectionId: dto.groupId,
            },
            update: {},
          });
        }
      }

      return (tx.contentItem as any).update({
        where: { id },
        data: {
          title: dto.title,
          tagObjects:
            dto.tags !== undefined
              ? await this.tagsService.prepareTagsConnectOrCreate(
                  dto.tags ?? [],
                  {
                    projectId: item.projectId ?? undefined,
                    userId: item.userId ?? undefined,
                  },
                  'CONTENT_LIBRARY',
                  true,
                )
              : undefined,
          note: dto.note,
        },
        include: {
          tagObjects: true,
          media: {
            orderBy: { order: 'asc' },
            include: { media: true },
          },
        },
      });
    });

    return this.normalizeContentItemTags(updated);
  }

  public async archive(id: string, userId: string) {
    await this.assertContentItemMutationAllowed(id, userId);

    return this.prisma.contentItem.update({
      where: { id },
      data: {
        archivedAt: new Date(),
        archivedBy: userId,
      },
    });
  }

  public async restore(id: string, userId: string) {
    await this.assertContentItemMutationAllowed(id, userId);

    return this.prisma.contentItem.update({
      where: { id },
      data: {
        archivedAt: null,
        archivedBy: null,
      },
    });
  }

  public async purgeArchivedByProject(projectId: string, userId: string) {
    await this.assertProjectOwner(projectId, userId);

    const result = await this.prisma.contentItem.deleteMany({
      where: {
        projectId,
        archivedAt: { not: null },
      },
    });

    return { deletedCount: result.count };
  }

  public async purgeArchivedPersonal(userId: string) {
    const result = await this.prisma.contentItem.deleteMany({
      where: {
        userId,
        projectId: null,
        archivedAt: { not: null },
      },
    });

    return { deletedCount: result.count };
  }

  public async bulkOperation(userId: string, dto: BulkOperationDto) {
    const { ids, operation } = dto;

    if (!ids || ids.length === 0) {
      return { count: 0 };
    }

    const items = await (this.prisma.contentItem as any).findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        userId: true,
        projectId: true,
        archivedAt: true,
        title: true,
      },
    });

    const itemsById = new Map<string, any>((items ?? []).map((i: any) => [i.id, i]));

    const requiresAllOrNothingAuthorization = operation === BulkOperationType.MERGE;

    const uniqueProjectIds = Array.from(
      new Set<string>(
        (items ?? [])
          .map((i: any) => i?.projectId)
          .filter((p: unknown): p is string => typeof p === 'string' && p.length > 0),
      ),
    );

    const projectIdToPermissionError = new Map<string, any>();
    for (const projectId of uniqueProjectIds) {
      try {
        await this.permissions.checkProjectPermission(projectId, userId, ['ADMIN', 'EDITOR']);
      } catch (e) {
        projectIdToPermissionError.set(projectId, e);
      }
    }

    const authorizedIds: string[] = [];
    const authorizedItems = new Map<
      string,
      { id: string; userId: string | null; projectId: string | null }
    >();

    for (const id of ids) {
      const item = itemsById.get(id);

      if (!item) {
        if (requiresAllOrNothingAuthorization) {
          throw new ForbiddenException('Bulk MERGE requires access to all items');
        }
        this.logger.warn(`User ${userId} attempted bulk ${operation} on missing item ${id}`);
        continue;
      }

      if (item.projectId) {
        const err = projectIdToPermissionError.get(item.projectId);
        if (err) {
          if (requiresAllOrNothingAuthorization) {
            throw err;
          }
          this.logger.warn(
            `User ${userId} attempted bulk ${operation} on item ${id} without permission`,
          );
          continue;
        }
      } else if (item.userId !== userId) {
        if (requiresAllOrNothingAuthorization) {
          throw new ForbiddenException('Bulk MERGE requires access to all items');
        }
        this.logger.warn(
          `User ${userId} attempted bulk ${operation} on item ${id} without permission`,
        );
        continue;
      }

      authorizedIds.push(id);
      authorizedItems.set(id, item);
    }

    if (authorizedIds.length === 0) {
      return { count: 0 };
    }

    switch (operation) {
      case BulkOperationType.DELETE:
        return this.prisma.contentItem.deleteMany({
          where: { id: { in: authorizedIds } },
        });

      case BulkOperationType.ARCHIVE:
        return this.prisma.contentItem.updateMany({
          where: { id: { in: authorizedIds } },
          data: {
            archivedAt: new Date(),
            archivedBy: userId,
          },
        });

      case BulkOperationType.UNARCHIVE:
        return this.prisma.contentItem.updateMany({
          where: { id: { in: authorizedIds } },
          data: {
            archivedAt: null,
            archivedBy: null,
          },
        });

      case BulkOperationType.SET_PROJECT:
        if (dto.projectId) {
          await this.permissions.checkProjectPermission(dto.projectId, userId, ['ADMIN', 'EDITOR']);
        }

        await this.prisma.$transaction(
          authorizedIds.map(id =>
            (this.prisma.contentItem as any).update({
              where: { id },
              data: dto.projectId
                ? {
                    projectId: dto.projectId,
                    userId: null,
                  }
                : {
                    projectId: null,
                    userId,
                  },
            }),
          ),
        );

        await (this.prisma as any).contentItemGroup.deleteMany({
          where: {
            contentItemId: { in: authorizedIds },
          },
        });

        return { count: authorizedIds.length };

      case BulkOperationType.MERGE: {
        if (authorizedIds.length < 2) {
          throw new BadRequestException('At least two items are required for merging');
        }

        // Use the first item as target (usually the most recent one by default order)
        const targetId = authorizedIds[0];
        const sourceIds = authorizedIds.slice(1);

        const items = await (this.prisma.contentItem as any).findMany({
          where: { id: { in: authorizedIds } },
          include: {
            tagObjects: true,
            media: { orderBy: { order: 'asc' } },
          },
        });

        const targetItem = items.find((i: any) => i.id === targetId);
        const sourceItems = items.filter((i: any) => i.id !== targetId);

        if (!targetItem) {
          throw new NotFoundException('Target item not found');
        }

        const mergedTitleParts = items
          .map((i: any) => (typeof i.title === 'string' ? i.title.trim() : ''))
          .filter(Boolean);
        const newTitle = Array.from(new Set(mergedTitleParts)).join(' | ') || null;

        const mergedTextParts = items
          .map((i: any) => (typeof i.text === 'string' ? i.text.trim() : ''))
          .filter(Boolean);
        const newText = mergedTextParts.join(TEXT_MERGE_SEPARATOR) || null;

        const mergedNoteParts = items
          .map((i: any) => (typeof i.note === 'string' ? i.note.trim() : ''))
          .filter(Boolean);
        const newNote = mergedNoteParts.join(TEXT_MERGE_SEPARATOR) || null;

        const mergedTagNames = items.flatMap((i: any) =>
          (i.tagObjects ?? []).map((t: any) => t.name),
        );
        const newTags = this.normalizeTags(mergedTagNames);

        const targetMeta =
          typeof targetItem.meta === 'object' && targetItem.meta !== null
            ? (targetItem.meta as Record<string, any>)
            : {};
        const existingMerged = Array.isArray((targetMeta as any).mergedContentItems)
          ? (targetMeta as any).mergedContentItems
          : [];
        const removedMetas = sourceItems
          .map((i: any) => i?.meta)
          .filter((m: any) => typeof m === 'object' && m !== null)
          .filter((m: any) => Object.keys(m).length > 0);
        const nextMerged = [...existingMerged, ...removedMetas];
        const newMeta =
          nextMerged.length > 0
            ? {
                ...targetMeta,
                mergedContentItems: nextMerged,
              }
            : {
                ...targetMeta,
              };

        // 5. Combine Media
        const mediaPick = new Map<
          string,
          { mediaId: string; hasSpoiler: boolean; firstSeenAt: number }
        >();
        let seenCounter = 0;
        for (const i of items) {
          for (const link of i.media ?? []) {
            if (!link?.mediaId) continue;
            if (!mediaPick.has(link.mediaId)) {
              mediaPick.set(link.mediaId, {
                mediaId: link.mediaId,
                hasSpoiler: !!link.hasSpoiler,
                firstSeenAt: seenCounter++,
              });
            }
          }
        }
        const mergedMedia = Array.from(mediaPick.values())
          .sort((a, b) => a.firstSeenAt - b.firstSeenAt)
          .map((m, idx) => ({
            mediaId: m.mediaId,
            order: idx,
            hasSpoiler: m.hasSpoiler,
          }));

        await this.prisma.$transaction(async tx => {
          // Update target item
          await (tx.contentItem as any).update({
            where: { id: targetId },
            data: {
              title: newTitle,
              text: newText,
              note: newNote,
              meta: newMeta as any,
              tagObjects: await this.tagsService.prepareTagsConnectOrCreate(
                newTags,
                {
                  projectId: targetItem.projectId ?? undefined,
                  userId: targetItem.userId ?? undefined,
                },
                'CONTENT_LIBRARY',
                true,
              ),
            },
          });

          await (tx as any).contentItemMedia.deleteMany({ where: { contentItemId: targetId } });
          if (mergedMedia.length > 0) {
            await (tx as any).contentItemMedia.createMany({
              data: mergedMedia.map(m => ({
                contentItemId: targetId,
                mediaId: m.mediaId,
                order: m.order,
                hasSpoiler: m.hasSpoiler,
              })),
            });
          }

          // Delete source items
          await tx.contentItem.deleteMany({
            where: { id: { in: sourceIds } },
          });
        });

        return { count: authorizedIds.length, targetId };
      }

      case BulkOperationType.LINK_TO_GROUP: {
        if (!dto.groupId) {
          throw new BadRequestException('groupId is required for LINK_TO_GROUP operation');
        }

        const targetGroup = await this.prisma.contentCollection.findUnique({
          where: { id: dto.groupId },
          select: { id: true, type: true, projectId: true },
        });

        if (!targetGroup || (targetGroup.type as any) !== 'GROUP') {
          throw new BadRequestException('Target group not found');
        }

        const targetScope: 'personal' | 'project' = targetGroup.projectId ? 'project' : 'personal';
        const targetProjectId = targetGroup.projectId ?? undefined;

        await this.assertGroupTabAccess({
          groupId: dto.groupId,
          scope: targetScope,
          projectId: targetProjectId,
          userId,
        });

        for (const id of authorizedIds) {
          const item = authorizedItems.get(id);
          if (!item) {
            continue;
          }

          this.assertItemScopeMatches({
            item,
            scope: targetScope,
            projectId: targetProjectId,
          });
        }

        await this.prisma.$transaction(async tx => {
          for (const id of authorizedIds) {
            await (tx as any).contentItemGroup.upsert({
              where: {
                contentItemId_collectionId: {
                  contentItemId: id,
                  collectionId: dto.groupId!,
                },
              },
              create: {
                contentItemId: id,
                collectionId: dto.groupId!,
              },
              update: {},
            });
          }
        });

        return { count: authorizedIds.length };
      }

      case BulkOperationType.MOVE_TO_GROUP: {
        if (!dto.groupId) {
          throw new BadRequestException('groupId is required for MOVE_TO_GROUP operation');
        }
        if (!dto.sourceGroupId) {
          throw new BadRequestException('sourceGroupId is required for MOVE_TO_GROUP operation');
        }

        const targetGroup = await this.prisma.contentCollection.findUnique({
          where: { id: dto.groupId },
          select: { id: true, type: true, projectId: true },
        });

        if (!targetGroup || (targetGroup.type as any) !== 'GROUP') {
          throw new BadRequestException('Target group not found');
        }

        const targetScope: 'personal' | 'project' = targetGroup.projectId ? 'project' : 'personal';
        const targetProjectId = targetGroup.projectId ?? undefined;

        await this.assertGroupTabAccess({
          groupId: dto.groupId,
          scope: targetScope,
          projectId: targetProjectId,
          userId,
        });
        await this.assertGroupTabAccess({
          groupId: dto.sourceGroupId,
          scope: targetScope,
          projectId: targetProjectId,
          userId,
        });

        for (const id of authorizedIds) {
          const item = authorizedItems.get(id);
          if (!item) {
            continue;
          }

          this.assertItemScopeMatches({
            item,
            scope: targetScope,
            projectId: targetProjectId,
          });
        }

        await this.prisma.$transaction(async tx => {
          for (const id of authorizedIds) {
            if (dto.sourceGroupId !== dto.groupId) {
              await (tx as any).contentItemGroup.deleteMany({
                where: {
                  contentItemId: id,
                  collectionId: dto.sourceGroupId,
                },
              });
            }

            await (tx as any).contentItemGroup.upsert({
              where: {
                contentItemId_collectionId: {
                  contentItemId: id,
                  collectionId: dto.groupId!,
                },
              },
              create: {
                contentItemId: id,
                collectionId: dto.groupId!,
              },
              update: {},
            });
          }
        });

        return { count: authorizedIds.length };
      }

      default:
        throw new BadRequestException(`Unsupported operation: ${operation}`);
    }
  }

  public async sync(contentItemId: string, dto: SyncContentItemDto, userId: string) {
    const item = await this.assertContentItemAccess(contentItemId, userId, false);
    await this.assertContentItemMutationAllowed(contentItemId, userId);

    return this.prisma.$transaction(async tx => {
      // 1. Update item metadata (including tags)
      const tagData =
        dto.tags !== undefined
          ? await this.tagsService.prepareTagsConnectOrCreate(
              dto.tags ?? [],
              {
                projectId: item.projectId ?? undefined,
                userId: item.userId ?? undefined,
              },
              'CONTENT_LIBRARY',
              true,
            )
          : undefined;

      await tx.contentItem.update({
        where: { id: contentItemId },
        data: {
          title: dto.title,
          note: dto.note,
          tagObjects: tagData,
          text: this.normalizeItemText(dto.text),
          meta: dto.meta ? (dto.meta as any) : undefined,
        },
      });

      const incomingMediaIds = this.mapIncomingMediaIds(dto);
      if (incomingMediaIds) {
        await (tx as any).contentItemMedia.deleteMany({ where: { contentItemId } });
        if (incomingMediaIds.length > 0) {
          const spoilerByMediaId = new Map<string, boolean>();
          for (const m of dto.media ?? []) {
            spoilerByMediaId.set(m.mediaId, !!m.hasSpoiler);
          }
          await (tx as any).contentItemMedia.createMany({
            data: incomingMediaIds.map((mediaId, idx) => ({
              contentItemId,
              mediaId,
              order: idx,
              hasSpoiler: spoilerByMediaId.get(mediaId) ?? false,
            })),
          });
        }
      }

      return this.findOne(contentItemId, userId);
    });
  }

  public async getAvailableTags(
    scope: 'project' | 'personal',
    projectId: string | undefined,
    userId: string,
    groupId?: string,
  ) {
    if (scope === 'project') {
      if (!projectId) {
        throw new BadRequestException('projectId is required for project scope');
      }
      await this.permissions.checkProjectAccess(projectId, userId, true);
    }

    if (groupId) {
      await this.assertGroupTabAccess({
        groupId,
        scope,
        projectId: scope === 'project' ? projectId : undefined,
        userId,
      });
    }

    const tags = await this.prisma.tag.findMany({
      where: {
        ...(scope === 'personal' ? { userId } : { projectId }),
        domain: 'CONTENT_LIBRARY',
        contentItems: groupId
          ? {
              some: {
                groups: { some: { collectionId: groupId } },
              },
            }
          : { some: {} },
      },
      select: { name: true },
      distinct: ['name'],
      orderBy: { name: 'asc' },
    });

    return tags.map(t => t.name);
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
    const take = Math.min(Math.max(Number(query.limit) || 20, 1), 50);
    const normalizedQ = String(query.q ?? '')
      .trim()
      .toLowerCase();
    if (!normalizedQ) return [];

    if (query.scope === 'project') {
      if (!query.projectId) {
        throw new BadRequestException('projectId is required for project scope');
      }
      await this.permissions.checkProjectAccess(query.projectId, userId, true);
    }

    if (query.groupId) {
      await this.assertGroupTabAccess({
        groupId: query.groupId,
        scope: query.scope,
        projectId: query.scope === 'project' ? query.projectId : undefined,
        userId,
      });
    }

    const where: any = {
      AND: [{ domain: 'CONTENT_LIBRARY' }, { normalizedName: { startsWith: normalizedQ } }],
    };

    if (query.scope === 'project') {
      where.AND.push({ projectId: query.projectId });
    } else {
      where.AND.push({ userId, projectId: null });
    }

    if (query.groupId) {
      where.AND.push({
        contentItems: {
          some: {
            groups: { some: { collectionId: query.groupId } },
          },
        },
      });
    } else {
      where.AND.push({ contentItems: { some: {} } });
    }

    const tags = await this.prisma.tag.findMany({
      where,
      take,
      orderBy: { name: 'asc' },
      select: { name: true },
    });

    return tags.map(t => t.name);
  }

  public async listCollections(
    query: { scope: 'personal' | 'project'; projectId?: string },
    userId: string,
  ) {
    if (query.scope === 'project') {
      if (!query.projectId) {
        throw new BadRequestException('projectId is required for project scope');
      }
      await this.permissions.checkProjectAccess(query.projectId, userId, true);
    }

    const where: any = {};
    if (query.scope === 'personal') {
      where.userId = userId;
      where.projectId = null;
    } else {
      // In project scope:
      // - groups: shared + user-owned
      // - saved views: always personal to user within the project
      where.OR = [
        {
          projectId: query.projectId,
          type: 'GROUP',
          OR: [
            { groupType: 'PROJECT_SHARED', userId: null },
            { groupType: 'PROJECT_USER', userId },
          ],
        },
        {
          projectId: query.projectId,
          type: 'GROUP',
          // Backward-compatibility for existing shared groups without groupType
          groupType: null,
          userId: null,
        },
        {
          projectId: query.projectId,
          type: 'SAVED_VIEW',
          userId,
        },
      ];
    }

    const collections = await this.prisma.contentCollection.findMany({
      where,
      include: {
        _count: {
          select: {
            contentItemGroups: {
              where: {
                contentItem: { archivedAt: null },
              },
            },
          },
        },
      },
      orderBy: { order: 'asc' },
    });

    return collections.map(collection => {
      if (collection.type !== 'GROUP') {
        return collection;
      }

      return {
        ...collection,
        directItemsCount: (collection as any)._count?.contentItemGroups ?? 0,
      };
    });
  }

  public async createCollection(
    dto: {
      scope: 'personal' | 'project';
      projectId?: string;
      type: 'GROUP' | 'SAVED_VIEW';
      groupType?: 'PERSONAL_USER' | 'PROJECT_USER' | 'PROJECT_SHARED';
      parentId?: string;
      title: string;
      config?: unknown;
    },
    userId: string,
  ) {
    if (dto.scope === 'project') {
      if (!dto.projectId) {
        throw new BadRequestException('projectId is required for project scope');
      }
      await this.permissions.checkProjectAccess(dto.projectId, userId, true);
      await this.assertNotViewer(dto.projectId, userId);
    }

    if (dto.type === 'GROUP') {
      const groupType =
        dto.scope === 'personal' ? 'PERSONAL_USER' : (dto.groupType ?? 'PROJECT_USER');

      if (dto.scope === 'personal') {
        if (dto.groupType && dto.groupType !== 'PERSONAL_USER') {
          throw new BadRequestException('Invalid groupType for personal scope');
        }
      } else {
        if (groupType === 'PROJECT_SHARED') {
          await this.assertProjectOwnerOrAdmin(dto.projectId!, userId);
        }
      }
    } else {
      if (dto.groupType) {
        throw new BadRequestException('groupType is only allowed for GROUP collections');
      }
    }

    const scopeWhere: any =
      dto.scope === 'personal'
        ? { userId, projectId: null }
        : {
            projectId: dto.projectId,
            OR: [
              {
                type: 'GROUP',
                OR: [{ groupType: 'PROJECT_SHARED' }, { groupType: 'PROJECT_USER', userId }],
              },
              { type: 'GROUP', groupType: null, userId: null },
              { type: 'SAVED_VIEW', userId },
            ],
          };

    if (dto.type !== 'GROUP' && dto.parentId) {
      throw new BadRequestException('Only groups can have parent groups');
    }

    const resolvedChildGroupType: 'PERSONAL_USER' | 'PROJECT_USER' | 'PROJECT_SHARED' | undefined =
      dto.type === 'GROUP'
        ? dto.scope === 'personal'
          ? 'PERSONAL_USER'
          : (dto.groupType ?? 'PROJECT_USER')
        : undefined;

    const parentId =
      dto.type === 'GROUP'
        ? await this.resolveParentGroupId({
            parentId: dto.parentId,
            scope: dto.scope,
            projectId: dto.projectId,
            userId,
            childGroupType: resolvedChildGroupType,
          })
        : null;

    return this.withSerializableRetry('createCollection', () =>
      this.prisma.$transaction(
        async tx => {
          const maxOrder = await tx.contentCollection.aggregate({
            where: scopeWhere,
            _max: { order: true },
          });

          const nextOrder = (maxOrder?._max?.order ?? -1) + 1;

          return (tx.contentCollection as any).create({
            data: {
              type: dto.type,
              title: dto.title,
              groupType: dto.type === 'GROUP' ? (resolvedChildGroupType as any) : null,
              userId:
                dto.scope === 'personal'
                  ? userId
                  : dto.type === 'SAVED_VIEW'
                    ? userId
                    : resolvedChildGroupType === 'PROJECT_SHARED'
                      ? null
                      : userId,
              projectId: dto.scope === 'project' ? dto.projectId! : null,
              parentId,
              order: nextOrder,
              config: (dto.config ?? {}) as any,
            },
          });
        },
        { isolationLevel: 'Serializable' },
      ),
    );
  }

  public async updateCollection(
    collectionId: string,
    dto: {
      scope: 'personal' | 'project';
      projectId?: string;
      parentId?: string | null;
      title?: string;
      config?: unknown;
    },
    userId: string,
  ) {
    const collection = await this.assertCollectionAccess({
      collectionId,
      scope: dto.scope,
      projectId: dto.projectId,
      userId,
      requireMutationPermission: true,
    });

    if ((collection.type as any) !== 'GROUP' && dto.parentId !== undefined) {
      throw new BadRequestException('Only groups can have parent groups');
    }

    const childGroupType =
      (collection.type as any) === 'GROUP' ? this.resolveGroupType(collection as any) : undefined;

    const parentId = await this.resolveParentGroupId({
      parentId: dto.parentId,
      scope: dto.scope,
      projectId: dto.projectId,
      userId,
      childGroupType,
    });

    if (parentId === collection.id) {
      throw new BadRequestException('Group cannot be parent of itself');
    }
    if (parentId) {
      await this.ensureNoTabCycle({ collectionId, parentId });
    }

    return (this.prisma.contentCollection as any).update({
      where: { id: collection.id },
      data: {
        parentId,
        title: dto.title,
        config: dto.config as any,
      },
    });
  }

  public async linkItemToGroup(
    contentItemId: string,
    dto: { scope: 'personal' | 'project'; projectId?: string; groupId: string },
    userId: string,
  ) {
    const item = await this.assertContentItemMutationAllowed(contentItemId, userId);
    this.assertItemScopeMatches({
      item,
      scope: dto.scope,
      projectId: dto.projectId,
    });
    await this.assertGroupTabAccess({
      groupId: dto.groupId,
      scope: dto.scope,
      projectId: dto.projectId,
      userId,
    });

    await (this.prisma as any).contentItemGroup.upsert({
      where: {
        contentItemId_collectionId: {
          contentItemId,
          collectionId: dto.groupId,
        },
      },
      create: {
        contentItemId,
        collectionId: dto.groupId,
      },
      update: {},
    });

    return this.findOne(contentItemId, userId);
  }

  public async deleteCollection(
    collectionId: string,
    options: { scope: 'personal' | 'project'; projectId?: string },
    userId: string,
  ) {
    const collection = await this.assertCollectionAccess({
      collectionId,
      scope: options.scope,
      projectId: options.projectId,
      userId,
      requireMutationPermission: true,
    });

    if ((collection.type as any) !== 'GROUP') {
      return this.prisma.contentCollection.delete({ where: { id: collectionId } });
    }

    return this.prisma.$transaction(async tx => {
      // Find all descendant groups recursively to delete them as well
      const allIdsToDelete = [collectionId];
      let currentParentIds = [collectionId];

      while (currentParentIds.length > 0) {
        const children = await tx.contentCollection.findMany({
          where: { parentId: { in: currentParentIds } },
          select: { id: true },
        });

        if (children.length === 0) break;

        const childIds = children.map(c => c.id);
        allIdsToDelete.push(...childIds);
        currentParentIds = childIds;
      }

      // Remove all group relations for the deleted groups.
      await (tx as any).contentItemGroup.deleteMany({
        where: { collectionId: { in: allIdsToDelete } },
      });

      return tx.contentCollection.deleteMany({
        where: { id: { in: allIdsToDelete } },
      });
    });
  }

  public async reorderCollections(
    dto: { scope: 'personal' | 'project'; projectId?: string; ids: string[] },
    userId: string,
  ) {
    if (dto.scope === 'project') {
      if (!dto.projectId) {
        throw new BadRequestException('projectId is required for project scope');
      }
      await this.permissions.checkProjectAccess(dto.projectId, userId, true);
      await this.assertNotViewer(dto.projectId, userId);
    }

    const where: any =
      dto.scope === 'personal'
        ? { userId, projectId: null }
        : {
            projectId: dto.projectId,
            OR: [
              {
                type: 'GROUP',
                OR: [{ groupType: 'PROJECT_SHARED' }, { groupType: 'PROJECT_USER', userId }],
              },
              { type: 'GROUP', groupType: null, userId: null },
              { type: 'SAVED_VIEW', userId },
            ],
          };

    const existing = await this.prisma.contentCollection.findMany({
      where,
      select: { id: true },
    });

    const existingIds = new Set(existing.map((t: any) => t.id));
    for (const id of dto.ids) {
      if (!existingIds.has(id)) {
        throw new BadRequestException('Tabs list contains invalid id');
      }
    }

    await this.prisma.$transaction(
      dto.ids.map((id, idx) =>
        this.prisma.contentCollection.update({
          where: { id },
          data: { order: idx },
        }),
      ),
    );

    return { ok: true };
  }
}
