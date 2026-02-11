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
  AttachContentBlockMediaDto,
  UpdateContentBlockMediaLinkDto,
  BulkOperationDto,
  CreateContentBlockDto,
  CreateContentItemDto,
  CreateContentLibraryTabDto,
  FindContentItemsQueryDto,
  ReorderContentBlockMediaDto,
  ReorderContentBlocksDto,
  UpdateContentItemDto,
  UpdateContentBlockDto,
  BulkOperationType,
  SyncContentBlocksDto,
  SyncContentItemDto,
} from './dto/index.js';

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

  private ensureHasAnyContent(input: { blocks?: Array<{ text?: unknown; media?: unknown[] }> }) {
    // Validation disabled to allow creating empty items
    /*
    const blocks = input.blocks ?? [];
    if (blocks.length === 0) {
      throw new BadRequestException('At least one content block is required');
    }

    const hasAnyNonEmptyBlock = blocks.some(b => {
      const hasText = typeof b.text === 'string' && b.text.trim().length > 0;
      const hasMedia = (b.media?.length ?? 0) > 0;
      return hasText || hasMedia;
    });

    if (!hasAnyNonEmptyBlock) {
      throw new BadRequestException('At least one content block must contain text or media');
    }
    */
  }

  private async assertContentItemAccess(
    contentItemId: string,
    userId: string,
    allowArchived = true,
  ) {
    const item = await this.prisma.contentItem.findUnique({
      where: { id: contentItemId },
      select: { id: true, userId: true, projectId: true, archivedAt: true, title: true },
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

  private async assertFolderTabAccess(options: {
    folderId: string;
    scope: 'personal' | 'project';
    projectId?: string;
    userId: string;
  }) {
    const tab = await (this.prisma as any).contentLibraryTab.findUnique({
      where: { id: options.folderId },
      select: { id: true, type: true, userId: true, projectId: true },
    });

    if (!tab) {
      throw new NotFoundException('Folder not found');
    }

    if (tab.type !== 'FOLDER') {
      throw new BadRequestException('Tab is not a folder');
    }

    if (
      (tab.userId === null && tab.projectId === null) ||
      (tab.userId !== null && tab.projectId !== null)
    ) {
      throw new BadRequestException('Invalid folder scope configuration');
    }

    if (options.scope === 'personal') {
      if (tab.userId !== options.userId || tab.projectId !== null) {
        throw new ForbiddenException('You do not have access to this folder');
      }
      return tab;
    }

    if (!options.projectId) {
      throw new BadRequestException('projectId is required for project scope');
    }

    if (tab.projectId !== options.projectId) {
      throw new ForbiddenException('Folder does not belong to this project');
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
    const tab = await (this.prisma as any).contentLibraryTab.findUnique({
      where: { id: options.tabId },
      select: { id: true, type: true, userId: true, projectId: true },
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

    if (query.folderId) {
      await this.assertFolderTabAccess({
        folderId: query.folderId,
        scope: query.scope,
        projectId: query.projectId,
        userId,
      });
      where.folderId = query.folderId;
    }

    if (query.tags && query.tags.length > 0) {
      where.tagObjects = { some: { name: { in: query.tags } } };
    }

    if (query.search) {
      const tagTokens = this.normalizeSearchTokens(query.search);
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { note: { contains: query.search, mode: 'insensitive' } },
        ...(tagTokens.length > 0
          ? ([{ tagObjects: { some: { name: { in: tagTokens } } } }] as any)
          : []),
        { blocks: { some: { text: { contains: query.search, mode: 'insensitive' } } } },
      ];
    }

    const includeBlocks = query.includeBlocks !== false;

    const [items, total, totalUnfiltered] = (await Promise.all([
      this.prisma.contentItem.findMany({
        where,
        orderBy: { [query.sortBy ?? 'createdAt']: query.sortOrder ?? 'desc' },
        take: limit,
        skip: offset,
        ...(includeBlocks
          ? {
              include: {
                tagObjects: true,
                blocks: {
                  orderBy: { order: 'asc' },
                  include: {
                    media: {
                      orderBy: { order: 'asc' },
                      include: { media: true },
                    },
                  },
                },
              },
            }
          : {}),
      }),
      this.prisma.contentItem.count({ where }),
      this.prisma.contentItem.count({
        where: {
          userId: query.scope === 'personal' ? userId : undefined,
          projectId: query.scope === 'project' ? query.projectId : undefined,
          archivedAt: null,
          folderId: query.folderId ? query.folderId : undefined,
        },
      }),
    ])) as [any[], number, number];

    return {
      items,
      total,
      totalUnfiltered,
      limit,
      offset,
    };
  }

  public async findOne(id: string, userId: string) {
    await this.assertContentItemAccess(id, userId, true);

    return (this.prisma.contentItem as any).findUnique({
      where: { id },
      include: {
        tagObjects: true,
        blocks: {
          orderBy: { order: 'asc' },
          include: {
            media: {
              orderBy: { order: 'asc' },
              include: { media: true },
            },
          },
        },
      },
    });
  }

  public async remove(id: string, userId: string) {
    await this.assertContentItemMutationAllowed(id, userId);

    return this.prisma.contentItem.delete({
      where: { id },
    });
  }

  public async create(dto: CreateContentItemDto, userId: string) {
    this.ensureHasAnyContent({ blocks: dto.blocks });

    if (dto.scope === 'project') {
      if (!dto.projectId) {
        throw new BadRequestException('projectId is required for project scope');
      }
      await this.assertProjectContentMutationAllowed(dto.projectId, userId);
    }

    if (dto.folderId) {
      await this.assertFolderTabAccess({
        folderId: dto.folderId,
        scope: dto.scope,
        projectId: dto.projectId,
        userId,
      });
    }

    const created = await (this.prisma.contentItem as any).create({
      data: {
        userId: dto.scope === 'personal' ? userId : null,
        projectId: dto.scope === 'project' ? dto.projectId! : null,
        folderId: dto.folderId ?? null,
        title: dto.title,
        tagObjects: (await this.tagsService.prepareTagsConnectOrCreate(dto.tags ?? [], {
          projectId: dto.scope === 'project' ? dto.projectId : undefined,
          userId: dto.scope === 'personal' ? userId : undefined,
        })) as any,
        note: dto.note,
        blocks: {
          create: (dto.blocks ?? []).map((b, idx) => ({
            text: b.text,
            order: b.order ?? idx,
            meta: (b.meta ?? {}) as any,
            media: {
              create: (b.media ?? []).map((m, mediaIdx) => ({
                mediaId: m.mediaId,
                order: m.order ?? mediaIdx,
                hasSpoiler: !!m.hasSpoiler,
              })),
            },
          })),
        },
      },
      include: {
        tagObjects: true,
        blocks: {
          orderBy: { order: 'asc' },
          include: {
            media: {
              orderBy: { order: 'asc' },
              include: { media: true },
            },
          },
        },
      },
    });

    return created;
  }

  public async update(id: string, dto: UpdateContentItemDto, userId: string) {
    const item = await this.assertContentItemMutationAllowed(id, userId);

    if (dto.folderId !== undefined && dto.folderId !== null) {
      if (dto.folderId) {
        await this.assertFolderTabAccess({
          folderId: dto.folderId,
          scope: item.projectId ? 'project' : 'personal',
          projectId: item.projectId ?? undefined,
          userId,
        });
      }
    }

    return (this.prisma.contentItem as any).update({
      where: { id },
      data: {
        folderId: dto.folderId,
        title: dto.title,
        tagObjects:
          dto.tags !== undefined
            ? ((await this.tagsService.prepareTagsConnectOrCreate(dto.tags ?? [], {
                projectId: item.projectId ?? undefined,
                userId: item.userId ?? undefined,
              })) as any)
            : undefined,
        note: dto.note,
      },
      include: {
        tagObjects: true,
        blocks: {
          orderBy: { order: 'asc' },
          include: {
            media: {
              orderBy: { order: 'asc' },
              include: { media: true },
            },
          },
        },
      },
    });
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

  public async createBlock(contentItemId: string, dto: CreateContentBlockDto, userId: string) {
    await this.assertContentItemAccess(contentItemId, userId, false);
    await this.assertContentItemMutationAllowed(contentItemId, userId);

    // Validation disabled to allow creating empty blocks from UI
    /*
    const hasText = (dto.text ?? '').trim().length > 0;
    const hasMedia = (dto.media?.length ?? 0) > 0;
    if (!hasText && !hasMedia) {
      throw new BadRequestException('Block must contain text or media');
    }
    */

    return this.withSerializableRetry('createBlock', () =>
      this.prisma.$transaction(
        async tx => {
          const maxOrderAgg = await (tx as any).contentBlock.aggregate({
            where: { contentItemId },
            _max: { order: true },
          });
          const nextOrder = (maxOrderAgg._max.order ?? -1) + 1;

          return (tx as any).contentBlock.create({
            data: {
              contentItemId,
              text: dto.text,
              order: dto.order ?? nextOrder,
              meta: (dto.meta ?? {}) as any,
              media: {
                create: (dto.media ?? []).map((m, idx) => ({
                  mediaId: m.mediaId,
                  order: m.order ?? idx,
                  hasSpoiler: !!m.hasSpoiler,
                })),
              },
            },
            include: {
              media: { orderBy: { order: 'asc' }, include: { media: true } },
            },
          });
        },
        { isolationLevel: 'Serializable' },
      ),
    );
  }

  public async updateBlock(
    contentItemId: string,
    blockId: string,
    dto: UpdateContentBlockDto,
    userId: string,
  ) {
    await this.assertContentItemAccess(contentItemId, userId, false);
    await this.assertContentItemMutationAllowed(contentItemId, userId);

    const block = await (this.prisma as any).contentBlock.findUnique({
      where: { id: blockId },
      select: { id: true, contentItemId: true },
    });
    if (block?.contentItemId !== contentItemId) {
      throw new NotFoundException('Content block not found');
    }

    return (this.prisma as any).contentBlock.update({
      where: { id: blockId },
      data: {
        text: dto.text,
        order: dto.order,
        meta: dto.meta ? (dto.meta as any) : undefined,
      },
      include: {
        media: { orderBy: { order: 'asc' }, include: { media: true } },
      },
    });
  }

  public async removeBlock(contentItemId: string, blockId: string, userId: string) {
    await this.assertContentItemAccess(contentItemId, userId, false);
    await this.assertContentItemMutationAllowed(contentItemId, userId);

    const block = await (this.prisma as any).contentBlock.findUnique({
      where: { id: blockId },
      select: { id: true, contentItemId: true },
    });
    if (block?.contentItemId !== contentItemId) {
      throw new NotFoundException('Content block not found');
    }

    return (this.prisma as any).contentBlock.delete({ where: { id: blockId } });
  }

  public async reorderBlocks(contentItemId: string, dto: ReorderContentBlocksDto, userId: string) {
    await this.assertContentItemAccess(contentItemId, userId, false);
    await this.assertContentItemMutationAllowed(contentItemId, userId);

    const ids = dto.blocks.map(b => b.id);
    const existing = await (this.prisma as any).contentBlock.findMany({
      where: { id: { in: ids }, contentItemId },
      select: { id: true },
    });

    if (existing.length !== ids.length) {
      throw new NotFoundException('Some blocks not found');
    }

    await this.prisma.$transaction(
      dto.blocks.map(b =>
        (this.prisma as any).contentBlock.update({
          where: { id: b.id },
          data: { order: b.order },
        }),
      ),
    );

    return { success: true };
  }

  public async updateBlockMediaLink(
    contentItemId: string,
    blockId: string,
    mediaLinkId: string,
    dto: UpdateContentBlockMediaLinkDto,
    userId: string,
  ) {
    await this.assertContentItemAccess(contentItemId, userId, false);
    await this.assertContentItemMutationAllowed(contentItemId, userId);

    const block = await (this.prisma as any).contentBlock.findUnique({
      where: { id: blockId },
      select: { id: true, contentItemId: true },
    });
    if (block?.contentItemId !== contentItemId) {
      throw new NotFoundException('Content block not found');
    }

    const link = await (this.prisma as any).contentBlockMedia.findUnique({
      where: { id: mediaLinkId },
      select: { id: true, contentBlockId: true },
    });

    if (link?.contentBlockId !== blockId) {
      throw new NotFoundException('Content block media not found');
    }

    return (this.prisma as any).contentBlockMedia.update({
      where: { id: mediaLinkId },
      data: {
        hasSpoiler: dto.hasSpoiler,
        order: dto.order,
      },
      include: { media: true },
    });
  }

  public async attachBlockMedia(
    contentItemId: string,
    blockId: string,
    dto: AttachContentBlockMediaDto,
    userId: string,
  ) {
    await this.assertContentItemAccess(contentItemId, userId, false);
    await this.assertContentItemMutationAllowed(contentItemId, userId);

    const block = await (this.prisma as any).contentBlock.findUnique({
      where: { id: blockId },
      select: { id: true, contentItemId: true },
    });
    if (block?.contentItemId !== contentItemId) {
      throw new NotFoundException('Content block not found');
    }

    const media = await this.prisma.media.findUnique({
      where: { id: dto.mediaId },
      select: { id: true },
    });
    if (!media) {
      throw new NotFoundException('Media not found');
    }

    return this.withSerializableRetry('attachBlockMedia', () =>
      this.prisma.$transaction(
        async tx => {
          const maxOrderAgg = await (tx as any).contentBlockMedia.aggregate({
            where: { contentBlockId: blockId },
            _max: { order: true },
          });
          const nextOrder = (maxOrderAgg._max.order ?? -1) + 1;

          return (tx as any).contentBlockMedia.create({
            data: {
              contentBlockId: blockId,
              mediaId: dto.mediaId,
              order: dto.order ?? nextOrder,
              hasSpoiler: !!dto.hasSpoiler,
            },
            include: { media: true },
          });
        },
        { isolationLevel: 'Serializable' },
      ),
    );
  }

  public async detachBlockMedia(
    contentItemId: string,
    blockId: string,
    mediaLinkId: string,
    userId: string,
  ) {
    await this.assertContentItemAccess(contentItemId, userId, false);
    await this.assertContentItemMutationAllowed(contentItemId, userId);

    const block = await (this.prisma as any).contentBlock.findUnique({
      where: { id: blockId },
      select: { id: true, contentItemId: true },
    });
    if (block?.contentItemId !== contentItemId) {
      throw new NotFoundException('Content block not found');
    }

    const link = await (this.prisma as any).contentBlockMedia.findUnique({
      where: { id: mediaLinkId },
      select: { id: true, contentBlockId: true },
    });

    if (link?.contentBlockId !== blockId) {
      throw new NotFoundException('Content block media not found');
    }

    return (this.prisma as any).contentBlockMedia.delete({ where: { id: mediaLinkId } });
  }

  public async reorderBlockMedia(
    contentItemId: string,
    blockId: string,
    dto: ReorderContentBlockMediaDto,
    userId: string,
  ) {
    await this.assertContentItemAccess(contentItemId, userId, false);
    await this.assertContentItemMutationAllowed(contentItemId, userId);

    const block = await (this.prisma as any).contentBlock.findUnique({
      where: { id: blockId },
      select: { id: true, contentItemId: true },
    });
    if (block?.contentItemId !== contentItemId) {
      throw new NotFoundException('Content block not found');
    }

    const ids = dto.media.map(m => m.id);
    const existing = await (this.prisma as any).contentBlockMedia.findMany({
      where: { id: { in: ids }, contentBlockId: blockId },
      select: { id: true },
    });

    if (existing.length !== ids.length) {
      throw new NotFoundException('Some media links not found');
    }

    await this.prisma.$transaction(
      dto.media.map(m =>
        (this.prisma as any).contentBlockMedia.update({
          where: { id: m.id },
          data: { order: m.order },
        }),
      ),
    );

    return { success: true };
  }

  public async bulkOperation(userId: string, dto: BulkOperationDto) {
    const { ids, operation } = dto;

    if (!ids || ids.length === 0) {
      return { count: 0 };
    }

    const authorizedIds: string[] = [];

    for (const id of ids) {
      try {
        await this.assertContentItemMutationAllowed(id, userId);
        authorizedIds.push(id);
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
            this.prisma.contentItem.update({
              where: { id },
              data: dto.projectId
                ? {
                    projectId: dto.projectId,
                    userId: null,
                    folderId: null,
                  }
                : {
                    projectId: null,
                    userId,
                    folderId: null,
                  },
            }),
          ),
        );

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
          include: { blocks: true },
        });

        const targetItem = items.find((i: any) => i.id === targetId);
        const sourceItems = items.filter((i: any) => i.id !== targetId);

        if (!targetItem) {
          throw new NotFoundException('Target item not found');
        }

        // 1. Combine Titles
        const allTitles = items.map((i: any) => i.title?.trim()).filter(Boolean);
        const newTitle = Array.from(new Set(allTitles)).join(' | ') || null;

        // 2. Combine Notes
        const allNotes = items.map((i: any) => i.note?.trim()).filter(Boolean);
        const newNote = allNotes.join('\n\n---\n\n') || null;

        // 3. Combine Tags (Unique)
        const allTags = items.flatMap((i: any) => i.tags || []);
        const newTags = this.normalizeTags(allTags);

        await this.prisma.$transaction(async tx => {
          // Update target item
          await (tx.contentItem as any).update({
            where: { id: targetId },
            data: {
              title: newTitle,
              note: newNote,
              tags: newTags,
            },
          });

          // Re-order and move blocks
          const currentMaxOrderAgg = await (tx as any).contentBlock.aggregate({
            where: { contentItemId: targetId },
            _max: { order: true },
          });
          let currentOrder = (currentMaxOrderAgg._max.order ?? -1) + 1;

          for (const source of sourceItems) {
            const sortedSourceBlocks = (source.blocks || []).sort(
              (a: any, b: any) => a.order - b.order,
            );
            for (const block of sortedSourceBlocks) {
              await (tx as any).contentBlock.update({
                where: { id: block.id },
                data: {
                  contentItemId: targetId,
                  order: currentOrder++,
                },
              });
            }
          }

          // Delete source items
          await tx.contentItem.deleteMany({
            where: { id: { in: sourceIds } },
          });
        });

        return { count: authorizedIds.length, targetId };
      }

      default:
        throw new BadRequestException(`Unsupported operation: ${operation}`);
    }
  }

  public async detachBlock(contentItemId: string, blockId: string, userId: string) {
    const sourceItem = await this.assertContentItemAccess(contentItemId, userId, false);
    await this.assertContentItemMutationAllowed(contentItemId, userId);

    const block = await (this.prisma as any).contentBlock.findUnique({
      where: { id: blockId },
      select: { id: true, contentItemId: true, text: true },
    });

    if (block?.contentItemId !== contentItemId) {
      throw new NotFoundException('Content block not found');
    }

    return this.prisma.$transaction(async tx => {
      const newItem = await (tx.contentItem as any).create({
        data: {
          userId: sourceItem.userId,
          projectId: sourceItem.projectId,
          title: block.text?.slice(0, 50) || 'Detached Block',
          note: null,
        },
      });

      await (tx as any).contentBlock.update({
        where: { id: blockId },
        data: {
          contentItemId: newItem.id,
          order: 0,
        },
      });

      return newItem;
    });
  }

  public async copyMediaToItem(
    contentItemId: string,
    blockId: string,
    mediaLinkId: string,
    userId: string,
  ) {
    const sourceItem = await this.assertContentItemAccess(contentItemId, userId, false);
    await this.assertContentItemMutationAllowed(contentItemId, userId);

    const block = await (this.prisma as any).contentBlock.findUnique({
      where: { id: blockId },
      select: { id: true, contentItemId: true },
    });
    if (block?.contentItemId !== contentItemId) {
      throw new NotFoundException('Content block not found');
    }

    const link = await (this.prisma as any).contentBlockMedia.findUnique({
      where: { id: mediaLinkId },
      select: { id: true, contentBlockId: true, mediaId: true, order: true, hasSpoiler: true },
    });

    if (link?.contentBlockId !== blockId) {
      throw new NotFoundException('Content block media not found');
    }

    return this.prisma.$transaction(async tx => {
      const newItem = await (tx.contentItem as any).create({
        data: {
          userId: sourceItem.userId,
          projectId: sourceItem.projectId,
          title: `Copy of media from ${sourceItem.title || 'unnamed item'}`,
          note: null,
          blocks: {
            create: [
              {
                text: '',
                order: 0,
                meta: {},
                media: {
                  create: [
                    {
                      mediaId: link.mediaId,
                      order: 0,
                      hasSpoiler: link.hasSpoiler,
                    },
                  ],
                },
              },
            ],
          },
        },
      });

      return newItem;
    });
  }

  public async sync(contentItemId: string, dto: SyncContentItemDto, userId: string) {
    await this.assertContentItemAccess(contentItemId, userId, false);
    await this.assertContentItemMutationAllowed(contentItemId, userId);

    return this.prisma.$transaction(async tx => {
      // 1. Update item metadata
      await tx.contentItem.update({
        where: { id: contentItemId },
        data: {
          title: dto.title,
          note: dto.note,
        },
      });

      // 2. Sync blocks
      const results = await this.performBlocksSync(tx, contentItemId, dto.blocks);

      return results;
    });
  }

  public async syncBlocks(contentItemId: string, dto: SyncContentBlocksDto, userId: string) {
    await this.assertContentItemAccess(contentItemId, userId, false);
    await this.assertContentItemMutationAllowed(contentItemId, userId);

    return this.prisma.$transaction(async tx => {
      return this.performBlocksSync(tx, contentItemId, dto.blocks);
    });
  }

  private async performBlocksSync(tx: any, contentItemId: string, blocks: any[]) {
    const existingBlocks = await tx.contentBlock.findMany({
      where: { contentItemId },
      select: { id: true },
    });

    const existingIds = new Set(existingBlocks.map((b: { id: string }) => b.id));
    const incomingIds = new Set(blocks.map((b: any) => b.id).filter(Boolean));

    // Delete blocks that are no longer present
    const toDelete = existingBlocks
      .filter((b: { id: string }) => !incomingIds.has(b.id))
      .map((b: { id: string }) => b.id);
    if (toDelete.length > 0) {
      await tx.contentBlock.deleteMany({
        where: { id: { in: toDelete } },
      });
    }

    const results = [];

    for (const b of blocks) {
      const blockData = {
        text: b.text,
        order: b.order,
        meta: b.meta ?? {},
      };

      let blockId = b.id;
      let syncResult;

      if (blockId && existingIds.has(blockId)) {
        // Update existing block
        syncResult = await tx.contentBlock.update({
          where: { id: blockId },
          data: blockData,
          include: {
            media: { select: { id: true, mediaId: true } },
          },
        });
      } else {
        // Create new block
        syncResult = await tx.contentBlock.create({
          data: {
            ...blockData,
            contentItemId,
          },
          include: {
            media: { select: { id: true, mediaId: true } },
          },
        });
        blockId = syncResult.id;
      }

      // Sync block media if provided
      if (b.mediaIds) {
        const existingMediaLinks = syncResult.media;
        const incomingMediaIds = b.mediaIds;

        // Simple sync: delete all and recreate or match by mediaId
        // To be safe and simple, let's delete existing and recreate in order
        await tx.contentBlockMedia.deleteMany({
          where: { contentBlockId: blockId },
        });

        if (incomingMediaIds.length > 0) {
          await tx.contentBlockMedia.createMany({
            data: incomingMediaIds.map((mediaId: string, idx: number) => ({
              contentBlockId: blockId,
              mediaId,
              order: idx,
            })),
          });
        }
      }

      results.push(syncResult);
    }

    return results;
  }

  public async getAvailableTags(
    scope: 'project' | 'personal',
    projectId: string | undefined,
    userId: string,
  ) {
    if (scope === 'project') {
      if (!projectId) {
        throw new BadRequestException('projectId is required for project scope');
      }
      await this.permissions.checkProjectAccess(projectId, userId, true);
    }

    const tags = await this.prisma.tag.findMany({
      where:
        scope === 'project'
          ? {
              projectId: projectId!,
              contentItems: { some: {} },
            }
          : {
              userId,
              projectId: null,
              contentItems: { some: {} },
            },
      select: { name: true },
      orderBy: { name: 'asc' },
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

    return this.prisma.contentLibraryTab.findMany({
      where,
      orderBy: { order: 'asc' },
    });
  }

  public async createTab(
    dto: {
      scope: 'personal' | 'project';
      projectId?: string;
      type: 'FOLDER' | 'SAVED_VIEW';
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

    return this.withSerializableRetry('createTab', () =>
      this.prisma.$transaction(
        async tx => {
          const maxOrder = await tx.contentLibraryTab.aggregate({
            where: scopeWhere,
            _max: { order: true },
          });

          const nextOrder = (maxOrder?._max?.order ?? -1) + 1;

          return tx.contentLibraryTab.create({
            data: {
              type: dto.type,
              title: dto.title,
              userId: dto.scope === 'personal' ? userId : null,
              projectId: dto.scope === 'project' ? dto.projectId! : null,
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
    dto: { scope: 'personal' | 'project'; projectId?: string; title?: string; config?: unknown },
    userId: string,
  ) {
    const tab = await this.assertTabAccess({
      tabId,
      scope: dto.scope,
      projectId: dto.projectId,
      userId,
      requireMutationPermission: true,
    });

    return this.prisma.contentLibraryTab.update({
      where: { id: tab.id },
      data: {
        title: dto.title,
        config: dto.config as any,
      },
    });
  }

  public async deleteTab(
    tabId: string,
    options: { scope: 'personal' | 'project'; projectId?: string },
    userId: string,
  ) {
    await this.assertTabAccess({
      tabId,
      scope: options.scope,
      projectId: options.projectId,
      userId,
      requireMutationPermission: true,
    });

    return this.prisma.contentLibraryTab.delete({ where: { id: tabId } });
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
