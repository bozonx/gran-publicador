import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';

import { PermissionsService } from '../../common/services/permissions.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TagsService } from '../tags/tags.service.js';
import { normalizeTags } from '../../common/utils/tags.util.js';
import { ContentCollectionsService } from './content-collections.service.js';
import { UnsplashService } from './unsplash.service.js';
import { MediaService } from '../media/media.service.js';
import { ContentLibraryMapper } from './content-library.mapper.js';
import { MediaType, StorageType, Prisma } from '../../generated/prisma/index.js';
import {
  BulkOperationDto,
  CreateContentItemDto,
  FindContentItemsQueryDto,
  UpdateContentItemDto,
  BulkOperationType,
  SyncContentItemDto,
} from './dto/index.js';

@Injectable()
export class ContentItemsService {
  private readonly logger = new Logger(ContentItemsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly tagsService: TagsService,
    private readonly collectionsService: ContentCollectionsService,
    private readonly mediaService: MediaService,
    private readonly unsplashService: UnsplashService,
    private readonly mapper: ContentLibraryMapper,
  ) {}

  private normalizeSearchTokens(search: string): string[] {
    return search
      .split(/[,\s]+/)
      .map(t => t.trim())
      .filter(Boolean)
      .map(t => t.toLowerCase())
      .slice(0, 20);
  }

  private mapIncomingMediaIds(dto: any): string[] {
    return this.mapper.mapIncomingMediaIds(dto);
  }

  private normalizeContentItemTags(item: any): any {
    return this.mapper.mapContentItem(item);
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
      where.collectionItems = { none: {} };
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

      where.collectionItems = {
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
            ] as Prisma.ContentItemWhereInput[])
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
          collectionItems: {
            include: {
              collection: {
                select: {
                  id: true,
                  title: true,
                  type: true,
                  parentId: true,
                  parent: {
                    select: {
                      title: true,
                    },
                  },
                },
              },
            },
          },
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
          } as Prisma.ContentItemCountArgs['where'],
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
          } as Prisma.ContentItemCountArgs['where'],
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
        collectionItems: {
          include: {
            collection: {
              select: {
                id: true,
                title: true,
                type: true,
                parentId: true,
                parent: {
                  select: {
                    title: true,
                  },
                },
              },
            },
          },
        },
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

    if (dto.publicationId) {
      const publication = await this.prisma.publication.findUnique({
        where: { id: dto.publicationId },
        select: { id: true, projectId: true },
      });
      if (!publication) {
        throw new BadRequestException('Publication not found');
      }

      if (dto.scope === 'project') {
        if (!dto.projectId || dto.projectId !== publication.projectId) {
          throw new BadRequestException('publicationId does not match content item project scope');
        }
        await this.permissions.checkProjectAccess(dto.projectId, userId, true);
      } else {
        throw new BadRequestException('publicationId is only allowed for project scope');
      }
    }

    if (dto.groupId) {
      await this.collectionsService.assertGroupAccess({
        groupId: dto.groupId,
        scope: dto.scope,
        projectId: dto.projectId,
        userId,
      });
    }

    if (dto.unsplashId) {
      const photo = await this.unsplashService.getPhoto(dto.unsplashId);
      if (!photo) {
        throw new BadRequestException('Unsplash photo not found');
      }

      const uploaded = await this.mediaService.uploadFileFromUrl(
        photo.urls.regular,
        `unsplash-${photo.id}.jpg`,
        userId,
        'CONTENT_LIBRARY',
        {
          lossless: false,
          stripMetadata: false,
          autoOrient: false,
          flatten: false,
        },
      );

      const media = await this.mediaService.create({
        type: MediaType.IMAGE,
        storageType: StorageType.STORAGE,
        storagePath: uploaded.fileId,
        filename: `unsplash-${photo.id}.jpg`,
        mimeType: uploaded.metadata.mimeType,
        sizeBytes: uploaded.metadata.size,
        meta: {
          ...uploaded.metadata,
          unsplashId: photo.id,
          unsplashUrl: photo.links.html,
          unsplashUser: photo.user.name,
          unsplashUsername: photo.user.username,
          unsplashUserUrl: photo.user.links.html,
        },
        description: `Photo by ${photo.user.name || photo.user.username || photo.id} on Unsplash`,
      });

      dto.media = [
        ...(dto.media || []),
        {
          mediaId: media.id,
          order: (dto.media || []).length,
          hasSpoiler: false,
        },
      ];

      if (!dto.title) {
        dto.title = photo.altDescription || photo.description || 'Unsplash Photo';
      }

      if (photo.description) {
        dto.text = photo.description;
      }

      if (photo.tags && photo.tags.length > 0) {
        dto.tags = Array.from(new Set([...(dto.tags || []), ...photo.tags.map(t => t.title)]));
      }
    }

    const created = await this.prisma.$transaction(async tx => {
      const contentItem = await tx.contentItem.create({
        data: {
          userId: dto.scope === 'personal' ? userId : null,
          projectId: dto.scope === 'project' ? dto.projectId! : null,
          collectionItems: dto.groupId
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
          text: this.mapper.normalizeItemText(dto.text),
          meta: (dto.meta ?? {}) as Prisma.JsonObject,
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

      if (dto.publicationId) {
        await tx.publicationContentItem.create({
          data: {
            publicationId: dto.publicationId,
            contentItemId: contentItem.id,
            order: 0,
          },
        });
      }

      return contentItem;
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
          await tx.contentCollectionItem.deleteMany({ where: { contentItemId: id } });
        } else {
          await tx.contentCollectionItem.upsert({
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
      if (dto.version !== undefined) {
        const { count } = await tx.contentItem.updateMany({
          where: { id, version: dto.version },
          data: {
            version: { increment: 1 },
            title: dto.title,
            note: dto.note,
          },
        });
        if (count === 0) {
          throw new ConflictException(
            'Item has been modified in another tab. Please refresh the page.',
          );
        }

        if (dto.tags !== undefined) {
          await tx.contentItem.update({
            where: { id },
            data: {
              tagObjects: await this.tagsService.prepareTagsConnectOrCreate(
                dto.tags ?? [],
                {
                  projectId: item.projectId ?? undefined,
                  userId: item.userId ?? undefined,
                },
                'CONTENT_LIBRARY',
                true,
              ),
            },
          });
        }
        return tx.contentItem.findUnique({
          where: { id },
          include: {
            tagObjects: true,
            media: {
              orderBy: { order: 'asc' },
              include: { media: true },
            },
          },
        });
      }

      return tx.contentItem.update({
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
                collectionItems: { some: { collectionId: groupId } },
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
      where.contentItems = {
        some: {
          collectionItems: { some: { collectionId: query.groupId } },
        },
      };
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

    await this.prisma.contentCollectionItem.upsert({
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
          text: this.mapper.normalizeItemText(dto.text),
          meta: dto.meta ? (dto.meta as Prisma.JsonObject) : undefined,
        },
      });

      const incomingMediaIds = this.mapIncomingMediaIds(dto);
      if (incomingMediaIds) {
        const uniqueIncomingMediaIds = Array.from(new Set(incomingMediaIds));
        if (uniqueIncomingMediaIds.length > 0) {
          const existing = await tx.media.findMany({
            where: { id: { in: uniqueIncomingMediaIds } },
            select: { id: true },
          });
          const existingIds = new Set<string>(existing.map((m: any) => m.id));
          const missing = uniqueIncomingMediaIds.filter(id => !existingIds.has(id));
          if (missing.length > 0) {
            throw new BadRequestException(`Media not found: ${missing.join(', ')}`);
          }
        }

        await tx.contentItemMedia.deleteMany({ where: { contentItemId } });
        if (incomingMediaIds.length > 0) {
          const spoilerByMediaId = new Map<string, boolean>();
          for (const m of dto.media ?? []) {
            spoilerByMediaId.set(m.mediaId, !!m.hasSpoiler);
          }
          await tx.contentItemMedia.createMany({
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

  public async unlinkItemFromGroup(contentItemId: string, collectionId: string, userId: string) {
    const item = await this.assertContentItemMutationAllowed(contentItemId, userId);

    const groupsCount = await this.prisma.contentCollectionItem.count({
      where: { contentItemId },
    });

    if (groupsCount <= 1) {
      throw new BadRequestException('Cannot unlink the last group from the content item');
    }

    await this.prisma.contentCollectionItem.delete({
      where: {
        contentItemId_collectionId: {
          contentItemId,
          collectionId,
        },
      },
    });

    return this.findOne(contentItemId, userId);
  }
}
