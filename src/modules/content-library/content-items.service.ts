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
import { ContentCollectionsService } from './content-collections.service.js';
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
export class ContentItemsService {
  private readonly logger = new Logger(ContentItemsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly tagsService: TagsService,
    private readonly collectionsService: ContentCollectionsService,
  ) {}

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

  private normalizeContentItemTags(item: any): any {
    if (!item) return item;
    return {
      ...item,
      tags: (item.tagObjects ?? []).map((t: any) => t.name).filter(Boolean),
    };
  }

  public async assertContentItemAccess(
    contentItemId: string,
    userId: string,
    allowArchived = true,
  ) {
    const item = await this.prisma.contentItem.findUnique({
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

  public async assertContentItemMutationAllowed(contentItemId: string, userId: string) {
    const item = await this.assertContentItemAccess(contentItemId, userId, true);

    if (item.projectId) {
      await this.permissions.checkProjectPermission(item.projectId, userId, ['ADMIN', 'EDITOR']);
    }

    return item;
  }

  private async assertProjectContentMutationAllowed(projectId: string, userId: string) {
    await this.permissions.checkProjectPermission(projectId, userId, ['ADMIN', 'EDITOR']);
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

    if (query.orphansOnly) {
      if (query.groupIds && query.groupIds.length > 0) {
        throw new BadRequestException('groupIds cannot be used together with orphansOnly');
      }
      where.groups = { none: {} };
    }

    const groupIds = Array.isArray(query.groupIds)
      ? Array.from(new Set(query.groupIds.filter(Boolean)))
      : [];

    if (groupIds.length > 0) {
      for (const groupId of groupIds) {
        await this.collectionsService.assertGroupAccess({
          groupId,
          scope: query.scope,
          projectId: query.projectId,
          userId,
        });
      }

      where.groups = {
        some: {
          collectionId: {
            in: groupIds,
          },
        },
      };
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

    const shouldIncludeTotalInScope = query.includeTotalInScope === true;

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
            ...(groupIds.length > 0
              ? {
                  groups: {
                    some: {
                      collectionId: {
                        in: groupIds,
                      },
                    },
                  },
                }
              : {}),
          } as any,
        }),
      );
    }

    if (shouldIncludeTotalInScope) {
      baseQueries.push(
        this.prisma.contentItem.count({
          where: {
            userId: query.scope === 'personal' ? userId : undefined,
            projectId: query.scope === 'project' ? query.projectId : undefined,
            archivedAt: null,
          } as any,
        }),
      );
    }

    const [items, total, totalUnfiltered, totalInScope] = (await Promise.all(baseQueries)) as [
      any[],
      number,
      number | undefined,
      number | undefined,
    ];

    return {
      items: items.map((item: any) => this.normalizeContentItemTags(item)),
      total,
      totalUnfiltered,
      totalInScope,
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
    if (dto.scope === 'project') {
      if (!dto.projectId) {
        throw new BadRequestException('projectId is required for project scope');
      }
      await this.assertProjectContentMutationAllowed(dto.projectId, userId);
    }

    if (dto.groupId) {
      await this.collectionsService.assertGroupAccess({
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
        await this.collectionsService.assertGroupAccess({
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
    await this.collectionsService.assertProjectOwner(projectId, userId);

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
      await this.collectionsService.assertGroupAccess({
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
      await this.collectionsService.assertGroupAccess({
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
        tagObjects: { select: { name: true } },
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
    const authorizedItems = new Map<string, (typeof items)[number]>();

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
          authorizedIds.map(id => {
            const item = authorizedItems.get(id);
            const tagNames = (item?.tagObjects ?? []).map((t: any) => t.name);

            return (this.prisma.contentItem as any).update({
              where: { id },
              data: {
                projectId: dto.projectId ?? null,
                userId: dto.projectId ? null : userId,
                tagObjects: {
                  set: [],
                  ...(tagNames.length > 0
                    ? {
                        connectOrCreate: tagNames.map((name: string) => {
                          const normalizedName = name.toLowerCase();
                          return dto.projectId
                            ? {
                                where: {
                                  projectId_domain_normalizedName: {
                                    projectId: dto.projectId,
                                    domain: 'CONTENT_LIBRARY',
                                    normalizedName,
                                  },
                                },
                                create: {
                                  projectId: dto.projectId,
                                  name,
                                  normalizedName,
                                  domain: 'CONTENT_LIBRARY',
                                },
                              }
                            : {
                                where: {
                                  userId_domain_normalizedName: {
                                    userId,
                                    domain: 'CONTENT_LIBRARY',
                                    normalizedName,
                                  },
                                },
                                create: {
                                  userId,
                                  name,
                                  normalizedName,
                                  domain: 'CONTENT_LIBRARY',
                                },
                              };
                        }),
                      }
                    : {}),
                },
              },
            });
          }),
        );

        await (this.prisma as any).contentItemGroup.deleteMany({
          where: {
            contentItemId: { in: authorizedIds },
          },
        });

        if (dto.groupId) {
          await this.prisma.$transaction(
            authorizedIds.map(id =>
              (this.prisma as any).contentItemGroup.create({
                data: {
                  contentItemId: id,
                  collectionId: dto.groupId!,
                },
              }),
            ),
          );
        }

        return { count: authorizedIds.length };

      case BulkOperationType.COPY_TO_PROJECT: {
        if (dto.projectId) {
          await this.permissions.checkProjectPermission(dto.projectId, userId, ['ADMIN', 'EDITOR']);
        }

        const fullItems = await (this.prisma.contentItem as any).findMany({
          where: { id: { in: authorizedIds } },
          select: {
            id: true,
            title: true,
            note: true,
            text: true,
            meta: true,
            tagObjects: { select: { name: true } },
            media: {
              orderBy: { order: 'asc' },
              select: { mediaId: true, order: true, hasSpoiler: true },
            },
          },
        });

        let targetGroupScope: 'personal' | 'project' | null = null;
        let targetGroupProjectId: string | undefined = undefined;

        if (dto.groupId) {
          const targetGroup = await this.prisma.contentCollection.findUnique({
            where: { id: dto.groupId },
            select: { id: true, type: true, projectId: true },
          });
          if (!targetGroup || (targetGroup.type as any) !== 'GROUP') {
            throw new BadRequestException('Target group not found');
          }

          targetGroupScope = targetGroup.projectId ? 'project' : 'personal';
          targetGroupProjectId = targetGroup.projectId ?? undefined;

          const expectedScope: 'personal' | 'project' = dto.projectId ? 'project' : 'personal';
          const expectedProjectId = dto.projectId ?? undefined;

          if (targetGroupScope !== expectedScope) {
            throw new BadRequestException('Target group scope does not match target project');
          }
          if ((targetGroupProjectId ?? undefined) !== expectedProjectId) {
            throw new BadRequestException('Target group project does not match target project');
          }

          await this.collectionsService.assertGroupAccess({
            groupId: dto.groupId,
            scope: targetGroupScope,
            projectId: targetGroupProjectId,
            userId,
          });
        }

        await this.prisma.$transaction(async tx => {
          for (const item of fullItems) {
            const tagNames = (item?.tagObjects ?? []).map((t: any) => t.name);
            const mediaLinks = Array.isArray(item?.media) ? item.media : [];

            const created = await (tx.contentItem as any).create({
              data: {
                title: item.title ?? null,
                note: item.note ?? null,
                text: item.text ?? null,
                meta: item.meta ?? {},
                projectId: dto.projectId ?? null,
                userId: dto.projectId ? null : userId,
                tagObjects: await this.tagsService.prepareTagsConnectOrCreate(
                  tagNames,
                  {
                    projectId: dto.projectId ?? undefined,
                    userId: dto.projectId ? undefined : userId,
                  },
                  'CONTENT_LIBRARY',
                ),
              },
              select: { id: true },
            });

            if (mediaLinks.length > 0) {
              await (tx as any).contentItemMedia.createMany({
                data: mediaLinks
                  .filter((m: any) => !!m?.mediaId)
                  .map((m: any) => ({
                    contentItemId: created.id,
                    mediaId: m.mediaId,
                    order: m.order ?? 0,
                    hasSpoiler: !!m.hasSpoiler,
                  })),
              });
            }

            if (dto.groupId) {
              await (tx as any).contentItemGroup.create({
                data: {
                  contentItemId: created.id,
                  collectionId: dto.groupId,
                },
              });
            }
          }
        });

        return { count: authorizedIds.length };
      }

      case BulkOperationType.MERGE: {
        if (authorizedIds.length < 2) {
          throw new BadRequestException('At least two items are required for merging');
        }

        const targetId = authorizedIds[0];
        const sourceIds = authorizedIds.slice(1);

        const fullItems = await (this.prisma.contentItem as any).findMany({
          where: { id: { in: authorizedIds } },
          include: {
            tagObjects: true,
            media: { orderBy: { order: 'asc' } },
          },
        });

        const targetItem = fullItems.find((i: any) => i.id === targetId);
        const sourceItems = fullItems.filter((i: any) => i.id !== targetId);

        if (!targetItem) {
          throw new NotFoundException('Target item not found');
        }

        const mergedTitleParts = fullItems
          .map((i: any) => (typeof i.title === 'string' ? i.title.trim() : ''))
          .filter(Boolean);
        const newTitle = Array.from(new Set(mergedTitleParts)).join(' | ') || null;

        const mergedTextParts = fullItems
          .map((i: any) => (typeof i.text === 'string' ? i.text.trim() : ''))
          .filter(Boolean);
        const newText = mergedTextParts.join(TEXT_MERGE_SEPARATOR) || null;

        const mergedNoteParts = fullItems
          .map((i: any) => (typeof i.note === 'string' ? i.note.trim() : ''))
          .filter(Boolean);
        const newNote = mergedNoteParts.join(TEXT_MERGE_SEPARATOR) || null;

        const mergedTagNames = fullItems.flatMap((i: any) =>
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

        const mediaPick = new Map<
          string,
          { mediaId: string; hasSpoiler: boolean; firstSeenAt: number }
        >();
        let seenCounter = 0;
        for (const i of fullItems) {
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

        await this.collectionsService.assertGroupAccess({
          groupId: dto.groupId,
          scope: targetScope,
          projectId: targetProjectId,
          userId,
        });

        for (const id of authorizedIds) {
          const item = authorizedItems.get(id);
          if (!item) continue;

          this.assertItemScopeMatches({
            item,
            scope: targetScope,
            projectId: targetProjectId,
          });
        }

        const existingLinks = await this.prisma.contentItemGroup.findMany({
          where: {
            contentItemId: { in: authorizedIds },
            collectionId: dto.groupId,
          },
          select: { contentItemId: true },
        });
        const alreadyLinkedItemIds = new Set(existingLinks.map(l => l.contentItemId));

        await this.prisma.$transaction(async tx => {
          for (const id of authorizedIds) {
            if (alreadyLinkedItemIds.has(id)) continue;
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
        if (!dto.groupId && !dto.sourceGroupId) {
          throw new BadRequestException(
            'Either groupId or sourceGroupId is required for MOVE_TO_GROUP operation',
          );
        }

        let targetProjectId: string | undefined = undefined;
        let targetScope: 'personal' | 'project' = 'personal';

        if (dto.groupId) {
          const targetGroup = await this.prisma.contentCollection.findUnique({
            where: { id: dto.groupId },
            select: { id: true, type: true, projectId: true },
          });

          if (!targetGroup || (targetGroup.type as any) !== 'GROUP') {
            throw new BadRequestException('Target group not found');
          }

          targetScope = targetGroup.projectId ? 'project' : 'personal';
          targetProjectId = targetGroup.projectId ?? undefined;

          await this.collectionsService.assertGroupAccess({
            groupId: dto.groupId,
            scope: targetScope,
            projectId: targetProjectId,
            userId,
          });
        } else if (dto.sourceGroupId) {
          const sourceGroup = await this.prisma.contentCollection.findUnique({
            where: { id: dto.sourceGroupId },
            select: { id: true, type: true, projectId: true },
          });
          if (sourceGroup) {
            targetScope = sourceGroup.projectId ? 'project' : 'personal';
            targetProjectId = sourceGroup.projectId ?? undefined;
          }
        }

        for (const id of authorizedIds) {
          const item = authorizedItems.get(id);
          if (!item) continue;

          this.assertItemScopeMatches({
            item,
            scope: targetScope,
            projectId: targetProjectId,
          });
        }

        const existingTargetLinks = dto.groupId
          ? await this.prisma.contentItemGroup.findMany({
              where: {
                contentItemId: { in: authorizedIds },
                collectionId: dto.groupId,
              },
              select: { contentItemId: true },
            })
          : [];
        const alreadyLinkedToTargetItemIds = new Set(existingTargetLinks.map(l => l.contentItemId));

        await this.prisma.$transaction(async tx => {
          for (const id of authorizedIds) {
            if (dto.sourceGroupId && dto.sourceGroupId !== dto.groupId) {
              await (tx as any).contentItemGroup.deleteMany({
                where: {
                  contentItemId: id,
                  collectionId: dto.sourceGroupId,
                },
              });
            }

            if (dto.groupId) {
              if (alreadyLinkedToTargetItemIds.has(id)) continue;
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
        });

        return { count: authorizedIds.length };
      }

      default:
        throw new BadRequestException(`Unsupported operation: ${operation}`);
    }
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
    await this.collectionsService.assertGroupAccess({
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

  public async sync(contentItemId: string, dto: SyncContentItemDto, userId: string) {
    const item = await this.assertContentItemAccess(contentItemId, userId, false);
    await this.assertContentItemMutationAllowed(contentItemId, userId);

    return this.prisma.$transaction(async tx => {
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
        const uniqueIncomingMediaIds = Array.from(new Set(incomingMediaIds));
        if (uniqueIncomingMediaIds.length > 0) {
          const existing = await (tx as any).media.findMany({
            where: { id: { in: uniqueIncomingMediaIds } },
            select: { id: true },
          });
          const existingIds = new Set<string>(existing.map((m: any) => m.id));
          const missing = uniqueIncomingMediaIds.filter(id => !existingIds.has(id));
          if (missing.length > 0) {
            throw new BadRequestException(`Media not found: ${missing.join(', ')}`);
          }
        }

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
}
