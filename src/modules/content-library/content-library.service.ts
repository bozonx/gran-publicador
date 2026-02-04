import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { PermissionsService } from '../../common/services/permissions.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  AttachContentBlockMediaDto,
  CreateContentBlockDto,
  CreateContentItemDto,
  FindContentItemsQueryDto,
  ReorderContentBlockMediaDto,
  ReorderContentBlocksDto,
  UpdateContentItemDto,
  UpdateContentBlockDto,
  BulkOperationDto,
  BulkOperationType,
} from './dto/index.js';

@Injectable()
export class ContentLibraryService {
  private readonly logger = new Logger(ContentLibraryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
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
      select: { id: true, userId: true, projectId: true, archivedAt: true },
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

    if (query.search) {
      const tagTokens = this.normalizeSearchTokens(query.search);
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { note: { contains: query.search, mode: 'insensitive' } },
        ...(tagTokens.length > 0 ? ([{ tags: { hasSome: tagTokens } }] as any) : []),
        { blocks: { some: { text: { contains: query.search, mode: 'insensitive' } } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.contentItem.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
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
      }),
      this.prisma.contentItem.count({ where }),
    ]);

    return {
      items,
      total,
      limit,
      offset,
    };
  }

  public async findOne(id: string, userId: string) {
    await this.assertContentItemAccess(id, userId, true);

    return (this.prisma.contentItem as any).findUnique({
      where: { id },
      include: {
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

    const created = await (this.prisma.contentItem as any).create({
      data: {
        userId: dto.scope === 'personal' ? userId : null,
        projectId: dto.scope === 'project' ? dto.projectId! : null,
        title: dto.title,
        tags: this.normalizeTags(dto.tags),
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
    await this.assertContentItemAccess(id, userId, false);
    await this.assertContentItemMutationAllowed(id, userId);

    return (this.prisma.contentItem as any).update({
      where: { id },
      data: {
        title: dto.title,
        tags: dto.tags ? this.normalizeTags(dto.tags) : undefined,
        note: dto.note,
      },
      include: {
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

    const maxOrderAgg = await (this.prisma as any).contentBlock.aggregate({
      where: { contentItemId },
      _max: { order: true },
    });
    const nextOrder = (maxOrderAgg._max.order ?? -1) + 1;

    return (this.prisma as any).contentBlock.create({
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
    if (!block || block.contentItemId !== contentItemId) {
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
    if (!block || block.contentItemId !== contentItemId) {
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
    if (!block || block.contentItemId !== contentItemId) {
      throw new NotFoundException('Content block not found');
    }

    const media = await this.prisma.media.findUnique({
      where: { id: dto.mediaId },
      select: { id: true },
    });
    if (!media) {
      throw new NotFoundException('Media not found');
    }

    const maxOrderAgg = await (this.prisma as any).contentBlockMedia.aggregate({
      where: { contentBlockId: blockId },
      _max: { order: true },
    });
    const nextOrder = (maxOrderAgg._max.order ?? -1) + 1;

    return (this.prisma as any).contentBlockMedia.create({
      data: {
        contentBlockId: blockId,
        mediaId: dto.mediaId,
        order: dto.order ?? nextOrder,
        hasSpoiler: !!dto.hasSpoiler,
      },
      include: { media: true },
    });
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
    if (!block || block.contentItemId !== contentItemId) {
      throw new NotFoundException('Content block not found');
    }

    const link = await (this.prisma as any).contentBlockMedia.findUnique({
      where: { id: mediaLinkId },
      select: { id: true, contentBlockId: true },
    });

    if (!link || link.contentBlockId !== blockId) {
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
    if (!block || block.contentItemId !== contentItemId) {
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
        // Ensure user has access to target project if it's set
        if (dto.projectId) {
          await this.permissions.checkProjectAccess(dto.projectId, userId, true);
        }

        return this.prisma.contentItem.updateMany({
          where: { id: { in: authorizedIds } },
          data: {
            projectId: dto.projectId || null,
          },
        });

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
        const allTitles = items
          .map((i: any) => i.title?.trim())
          .filter(Boolean);
        const newTitle = Array.from(new Set(allTitles)).join(' | ') || null;

        // 2. Combine Notes
        const allNotes = items
          .map((i: any) => i.note?.trim())
          .filter(Boolean);
        const newNote = allNotes.join('\n\n---\n\n') || null;

        // 3. Combine Tags (Unique)
        const allTags = items.flatMap((i: any) => i.tags || []);
        const newTags = this.normalizeTags(allTags);

        await this.prisma.$transaction(async (tx) => {
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
          let currentMaxOrderAgg = await (tx as any).contentBlock.aggregate({
            where: { contentItemId: targetId },
            _max: { order: true },
          });
          let currentOrder = (currentMaxOrderAgg._max.order ?? -1) + 1;

          for (const source of sourceItems) {
            const sortedSourceBlocks = (source.blocks || []).sort((a: any, b: any) => a.order - b.order);
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
}
