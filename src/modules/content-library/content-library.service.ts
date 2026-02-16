import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { PermissionsService } from '../../common/services/permissions.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TagsService } from '../tags/tags.service.js';
import {
  BulkOperationDto,
  CreateContentItemDto,
  CreateContentLibraryTabDto,
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
        groupId: true,
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
    const tab = await this.prisma.contentLibraryTab.findUnique({
      where: { id: options.groupId },
      select: { id: true, type: true, userId: true, projectId: true },
    });

    if (!tab) {
      throw new NotFoundException('Group not found');
    }

    if ((tab.type as any) !== 'GROUP') {
      throw new BadRequestException('Tab is not a group');
    }

    if (
      (tab.userId === null && tab.projectId === null) ||
      (tab.userId !== null && tab.projectId !== null)
    ) {
      throw new BadRequestException('Invalid group scope configuration');
    }

    if (options.scope === 'personal') {
      if (tab.userId !== options.userId || tab.projectId !== null) {
        throw new ForbiddenException('You do not have access to this group');
      }
      return tab;
    }

    if (!options.projectId) {
      throw new BadRequestException('projectId is required for project scope');
    }

    if (tab.projectId !== options.projectId) {
      throw new ForbiddenException('Group does not belong to this project');
    }

    await this.permissions.checkProjectAccess(options.projectId, options.userId, true);
    return tab;
  }

  private async assertTabAccess(options: {
    tabId: string;
    scope: 'personal' | 'project';
    projectId?: string;
    userId: string;
    requireMutationPermission?: boolean;
  }) {
    const tab = await this.prisma.contentLibraryTab.findUnique({
      where: { id: options.tabId },
      select: { id: true, type: true, userId: true, projectId: true, parentId: true },
    });

    if (!tab) {
      throw new NotFoundException('Tab not found');
    }

    if (
      (tab.userId === null && tab.projectId === null) ||
      (tab.userId !== null && tab.projectId !== null)
    ) {
      throw new BadRequestException('Invalid tab scope configuration');
    }

    if (options.scope === 'personal') {
      if (tab.userId !== options.userId || tab.projectId !== null) {
        throw new ForbiddenException('You do not have access to this tab');
      }
      return tab;
    }

    if (!options.projectId) {
      throw new BadRequestException('projectId is required for project scope');
    }

    if (tab.projectId !== options.projectId) {
      throw new ForbiddenException('Tab does not belong to this project');
    }

    await this.permissions.checkProjectAccess(options.projectId, options.userId, true);
    if (options.requireMutationPermission) {
      await this.permissions.checkProjectPermission(options.projectId, options.userId, [
        'ADMIN',
        'EDITOR',
      ]);
    }

    return tab;
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

    return parent.id;
  }

  private async ensureNoTabCycle(options: { tabId: string; parentId: string }) {
    const visited = new Set<string>();
    let cursor: string | null = options.parentId;

    while (cursor) {
      if (cursor === options.tabId) {
        throw new BadRequestException('Cannot move group into its descendant');
      }
      if (visited.has(cursor)) {
        throw new BadRequestException('Invalid group hierarchy');
      }
      visited.add(cursor);

      const node: { parentId: string | null } | null = await (
        this.prisma as any
      ).contentLibraryTab.findUnique({
        where: { id: cursor },
        select: { parentId: true },
      });
      cursor = node?.parentId ?? null;
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
      where.AND = [
        ...(where.AND ?? []),
        {
          OR: [{ groupId: query.groupId }, { groups: { some: { tabId: query.groupId } } }],
        },
      ];
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

    const [items, total, totalUnfiltered] = (await Promise.all([
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
      this.prisma.contentItem.count({
        where: {
          userId: query.scope === 'personal' ? userId : undefined,
          projectId: query.scope === 'project' ? query.projectId : undefined,
          archivedAt: null,
          ...(query.groupId
            ? {
                OR: [{ groupId: query.groupId }, { groups: { some: { tabId: query.groupId } } }],
              }
            : {}),
        } as any,
      }),
    ])) as [any[], number, number];

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
        groupId: dto.groupId ?? null,
        groups: dto.groupId
          ? {
              create: [{ tabId: dto.groupId }],
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
              contentItemId_tabId: {
                contentItemId: id,
                tabId: dto.groupId,
              },
            },
            create: {
              contentItemId: id,
              tabId: dto.groupId,
            },
            update: {},
          });
        }
      }

      return (tx.contentItem as any).update({
        where: { id },
        data: {
          groupId: dto.groupId,
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

    const authorizedIds: string[] = [];
    const authorizedItems = new Map<
      string,
      { id: string; userId: string | null; projectId: string | null; groupId: string | null }
    >();

    for (const id of ids) {
      try {
        const item = await this.assertContentItemMutationAllowed(id, userId);
        authorizedIds.push(id);
        authorizedItems.set(id, item);
      } catch (e) {
        this.logger.warn(
          `User ${userId} attempted bulk ${operation} on item ${id} without permission`,
        );
      }
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
                    groupId: null,
                  }
                : {
                    projectId: null,
                    userId,
                    groupId: null,
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

        const mergedTagNames = items.flatMap((i: any) =>
          (i.tagObjects ?? []).map((t: any) => t.name),
        );
        const newTags = this.normalizeTags(mergedTagNames);

        const targetMeta = (
          typeof targetItem.meta === 'object' && targetItem.meta !== null
            ? (targetItem.meta as Record<string, any>)
            : {}
        ) as Record<string, any>;
        const removedMetas = sourceItems
          .map((i: any) => i?.meta)
          .filter((m: any) => typeof m === 'object' && m !== null);
        const newMeta = {
          ...targetMeta,
          mergedContentItems: removedMetas,
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

        const targetGroup = await this.prisma.contentLibraryTab.findUnique({
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
                contentItemId_tabId: {
                  contentItemId: id,
                  tabId: dto.groupId!,
                },
              },
              create: {
                contentItemId: id,
                tabId: dto.groupId!,
              },
              update: {},
            });

            const item = authorizedItems.get(id);
            if (item?.groupId == null) {
              await (tx.contentItem as any).update({
                where: { id },
                data: { groupId: dto.groupId },
              });
            }
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

        const targetGroup = await this.prisma.contentLibraryTab.findUnique({
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
                  tabId: dto.sourceGroupId,
                },
              });
            }

            await (tx as any).contentItemGroup.upsert({
              where: {
                contentItemId_tabId: {
                  contentItemId: id,
                  tabId: dto.groupId!,
                },
              },
              create: {
                contentItemId: id,
                tabId: dto.groupId!,
              },
              update: {},
            });

            const item = authorizedItems.get(id);
            if (item && (item.groupId === dto.sourceGroupId || item.groupId == null)) {
              await (tx.contentItem as any).update({
                where: { id },
                data: { groupId: dto.groupId },
              });
            }
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
        ...(scope === 'project'
          ? {
              projectId: projectId!,
            }
          : {
              userId,
              projectId: null,
            }),
        domain: 'CONTENT_LIBRARY' as any,
        contentItems: groupId
          ? {
              some: {
                OR: [{ groupId }, { groups: { some: { tabId: groupId } } }],
              },
            }
          : { some: {} },
      } as any,
      select: { name: true },
      orderBy: { name: 'asc' },
    });

    return tags.map(t => t.name);
  }

  public async searchAvailableTags(
    query: {
      q: string;
      scope: 'personal' | 'project';
      projectId?: string;
      groupId?: string;
      limit?: number;
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
            OR: [{ groupId: query.groupId }, { groups: { some: { tabId: query.groupId } } }],
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

  public async listTabs(
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
      where.projectId = query.projectId;
    }

    const tabs = await this.prisma.contentLibraryTab.findMany({
      where,
      orderBy: { order: 'asc' },
    });

    const groupTabIds = tabs.filter(tab => (tab.type as any) === 'GROUP').map(tab => tab.id);
    if (groupTabIds.length === 0) {
      return tabs;
    }

    const groupCounts = await (this.prisma.contentItemGroup as any).groupBy({
      by: ['tabId'],
      where: {
        tabId: { in: groupTabIds },
        contentItem: {
          archivedAt: null,
        },
      },
      _count: {
        _all: true,
      },
    });

    const countByGroupId = new Map<string, number>(
      groupCounts.map((row: any) => [row.tabId as string, Number(row?._count?._all ?? 0)]),
    );

    return tabs.map(tab => {
      if ((tab.type as any) !== 'GROUP') {
        return tab;
      }

      return {
        ...tab,
        directItemsCount: countByGroupId.get(tab.id) ?? 0,
      };
    });
  }

  public async createTab(
    dto: {
      scope: 'personal' | 'project';
      projectId?: string;
      type: 'GROUP' | 'SAVED_VIEW';
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
      await this.permissions.checkProjectPermission(dto.projectId, userId, ['ADMIN', 'EDITOR']);
    }

    const scopeWhere: any =
      dto.scope === 'personal' ? { userId, projectId: null } : { projectId: dto.projectId };

    if (dto.type !== 'GROUP' && dto.parentId) {
      throw new BadRequestException('Only groups can have parent groups');
    }

    const parentId =
      dto.type === 'GROUP'
        ? await this.resolveParentGroupId({
            parentId: dto.parentId,
            scope: dto.scope,
            projectId: dto.projectId,
            userId,
          })
        : null;

    return this.withSerializableRetry('createTab', () =>
      this.prisma.$transaction(
        async tx => {
          const maxOrder = await tx.contentLibraryTab.aggregate({
            where: scopeWhere,
            _max: { order: true },
          });

          const nextOrder = (maxOrder?._max?.order ?? -1) + 1;

          return (tx.contentLibraryTab as any).create({
            data: {
              type: dto.type,
              title: dto.title,
              userId: dto.scope === 'personal' ? userId : null,
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

  public async updateTab(
    tabId: string,
    dto: {
      scope: 'personal' | 'project';
      projectId?: string;
      parentId?: string | null;
      title?: string;
      config?: unknown;
    },
    userId: string,
  ) {
    const tab = await this.assertTabAccess({
      tabId,
      scope: dto.scope,
      projectId: dto.projectId,
      userId,
      requireMutationPermission: true,
    });

    if ((tab.type as any) !== 'GROUP' && dto.parentId !== undefined) {
      throw new BadRequestException('Only groups can have parent groups');
    }

    const parentId = await this.resolveParentGroupId({
      parentId: dto.parentId,
      scope: dto.scope,
      projectId: dto.projectId,
      userId,
    });

    if (parentId === tab.id) {
      throw new BadRequestException('Group cannot be parent of itself');
    }
    if (parentId) {
      await this.ensureNoTabCycle({ tabId, parentId });
    }

    return (this.prisma.contentLibraryTab as any).update({
      where: { id: tab.id },
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

    await this.prisma.$transaction(async tx => {
      await (tx as any).contentItemGroup.upsert({
        where: {
          contentItemId_tabId: {
            contentItemId,
            tabId: dto.groupId,
          },
        },
        create: {
          contentItemId,
          tabId: dto.groupId,
        },
        update: {},
      });

      if (item.groupId == null) {
        await (tx.contentItem as any).update({
          where: { id: contentItemId },
          data: { groupId: dto.groupId },
        });
      }
    });

    return this.findOne(contentItemId, userId);
  }

  public async deleteTab(
    tabId: string,
    options: { scope: 'personal' | 'project'; projectId?: string },
    userId: string,
  ) {
    const tab = await this.assertTabAccess({
      tabId,
      scope: options.scope,
      projectId: options.projectId,
      userId,
      requireMutationPermission: true,
    });

    if ((tab.type as any) !== 'GROUP') {
      return this.prisma.contentLibraryTab.delete({ where: { id: tabId } });
    }

    return this.prisma.$transaction(async tx => {
      // Find all descendant groups recursively to delete them as well
      const allIdsToDelete = [tabId];
      let currentParentIds = [tabId];

      while (currentParentIds.length > 0) {
        const children = await tx.contentLibraryTab.findMany({
          where: { parentId: { in: currentParentIds } },
          select: { id: true },
        });

        if (children.length === 0) break;

        const childIds = children.map(c => c.id);
        allIdsToDelete.push(...childIds);
        currentParentIds = childIds;
      }

      // Move items from all groups being deleted to root.
      await tx.contentItem.updateMany({
        where: { groupId: { in: allIdsToDelete } },
        data: { groupId: null },
      });

      // Remove all group relations for the deleted groups.
      await (tx as any).contentItemGroup.deleteMany({
        where: { tabId: { in: allIdsToDelete } },
      });

      return tx.contentLibraryTab.deleteMany({
        where: { id: { in: allIdsToDelete } },
      });
    });
  }

  public async reorderTabs(
    dto: { scope: 'personal' | 'project'; projectId?: string; ids: string[] },
    userId: string,
  ) {
    if (dto.scope === 'project') {
      if (!dto.projectId) {
        throw new BadRequestException('projectId is required for project scope');
      }
      await this.permissions.checkProjectPermission(dto.projectId, userId, ['ADMIN', 'EDITOR']);
    }

    const where: any =
      dto.scope === 'personal' ? { userId, projectId: null } : { projectId: dto.projectId };

    const existing = await this.prisma.contentLibraryTab.findMany({
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
        this.prisma.contentLibraryTab.update({
          where: { id },
          data: { order: idx },
        }),
      ),
    );

    return { ok: true };
  }
}
