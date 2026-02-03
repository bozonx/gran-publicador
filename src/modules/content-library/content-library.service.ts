import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PermissionsService } from '../../common/services/permissions.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  AttachContentItemMediaDto,
  CreateContentItemDto,
  CreateContentTextDto,
  FindContentItemsQueryDto,
  ReorderContentItemMediaDto,
  ReorderContentTextsDto,
  UpdateContentItemDto,
  UpdateContentTextDto,
} from './dto/index.js';

@Injectable()
export class ContentLibraryService {
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

  private ensureHasAnyContent(input: { texts?: unknown[]; media?: unknown[] }) {
    const hasText = (input.texts?.length ?? 0) > 0;
    const hasMedia = (input.media?.length ?? 0) > 0;
    if (!hasText && !hasMedia) {
      throw new BadRequestException('Either at least one text or at least one media is required');
    }
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
        { texts: { some: { content: { contains: query.search, mode: 'insensitive' } } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.contentItem.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          texts: { orderBy: { order: 'asc' } },
          media: { orderBy: { order: 'asc' }, include: { media: true } },
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

    return this.prisma.contentItem.findUnique({
      where: { id },
      include: {
        texts: { orderBy: { order: 'asc' } },
        media: { orderBy: { order: 'asc' }, include: { media: true } },
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
    this.ensureHasAnyContent({ texts: dto.texts, media: dto.media });

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
        meta: (dto.meta ?? {}) as any,
        texts: {
          create: (dto.texts ?? []).map(t => ({
            content: t.content,
            type: t.type,
            order: t.order ?? 0,
            meta: (t.meta ?? {}) as any,
          })),
        },
        media: {
          create: (dto.media ?? []).map((m, idx) => ({
            mediaId: m.mediaId,
            order: idx,
            hasSpoiler: !!m.hasSpoiler,
          })),
        },
      },
      include: {
        texts: { orderBy: { order: 'asc' } },
        media: { orderBy: { order: 'asc' }, include: { media: true } },
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
        meta: dto.meta ? (dto.meta as any) : undefined,
      },
      include: {
        texts: { orderBy: { order: 'asc' } },
        media: { orderBy: { order: 'asc' }, include: { media: true } },
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

  public async createText(contentItemId: string, dto: CreateContentTextDto, userId: string) {
    await this.assertContentItemAccess(contentItemId, userId, false);
    await this.assertContentItemMutationAllowed(contentItemId, userId);

    const maxOrderAgg = await this.prisma.contentText.aggregate({
      where: { contentItemId },
      _max: { order: true },
    });
    const nextOrder = (maxOrderAgg._max.order ?? -1) + 1;

    return this.prisma.contentText.create({
      data: {
        contentItemId,
        content: dto.content,
        type: dto.type,
        order: dto.order ?? nextOrder,
        meta: (dto.meta ?? {}) as any,
      },
    });
  }

  public async updateText(
    contentItemId: string,
    textId: string,
    dto: UpdateContentTextDto,
    userId: string,
  ) {
    await this.assertContentItemAccess(contentItemId, userId, false);
    await this.assertContentItemMutationAllowed(contentItemId, userId);

    const text = await this.prisma.contentText.findUnique({
      where: { id: textId },
      select: { id: true, contentItemId: true },
    });
    if (!text || text.contentItemId !== contentItemId) {
      throw new NotFoundException('Content text not found');
    }

    return this.prisma.contentText.update({
      where: { id: textId },
      data: {
        content: dto.content,
        type: dto.type,
        order: dto.order,
        meta: dto.meta ? (dto.meta as any) : undefined,
      },
    });
  }

  public async removeText(contentItemId: string, textId: string, userId: string) {
    await this.assertContentItemAccess(contentItemId, userId, false);
    await this.assertContentItemMutationAllowed(contentItemId, userId);

    const text = await this.prisma.contentText.findUnique({
      where: { id: textId },
      select: { id: true, contentItemId: true },
    });
    if (!text || text.contentItemId !== contentItemId) {
      throw new NotFoundException('Content text not found');
    }

    return this.prisma.contentText.delete({ where: { id: textId } });
  }

  public async reorderTexts(contentItemId: string, dto: ReorderContentTextsDto, userId: string) {
    await this.assertContentItemAccess(contentItemId, userId, false);
    await this.assertContentItemMutationAllowed(contentItemId, userId);

    const ids = dto.texts.map(t => t.id);
    const existing = await this.prisma.contentText.findMany({
      where: { id: { in: ids }, contentItemId },
      select: { id: true },
    });

    if (existing.length !== ids.length) {
      throw new NotFoundException('Some texts not found');
    }

    await this.prisma.$transaction(
      dto.texts.map(t =>
        this.prisma.contentText.update({
          where: { id: t.id },
          data: { order: t.order },
        }),
      ),
    );

    return { success: true };
  }

  public async attachMedia(contentItemId: string, dto: AttachContentItemMediaDto, userId: string) {
    await this.assertContentItemAccess(contentItemId, userId, false);
    await this.assertContentItemMutationAllowed(contentItemId, userId);

    const media = await this.prisma.media.findUnique({
      where: { id: dto.mediaId },
      select: { id: true },
    });
    if (!media) {
      throw new NotFoundException('Media not found');
    }

    const maxOrderAgg = await this.prisma.contentItemMedia.aggregate({
      where: { contentItemId },
      _max: { order: true },
    });
    const nextOrder = (maxOrderAgg._max.order ?? -1) + 1;

    return this.prisma.contentItemMedia.create({
      data: {
        contentItemId,
        mediaId: dto.mediaId,
        order: nextOrder,
        hasSpoiler: !!dto.hasSpoiler,
      },
      include: { media: true },
    });
  }

  public async detachMedia(contentItemId: string, mediaLinkId: string, userId: string) {
    await this.assertContentItemAccess(contentItemId, userId, false);
    await this.assertContentItemMutationAllowed(contentItemId, userId);

    const link = await this.prisma.contentItemMedia.findUnique({
      where: { id: mediaLinkId },
      select: { id: true, contentItemId: true },
    });

    if (!link || link.contentItemId !== contentItemId) {
      throw new NotFoundException('Content item media not found');
    }

    return this.prisma.contentItemMedia.delete({ where: { id: mediaLinkId } });
  }

  public async reorderMedia(
    contentItemId: string,
    dto: ReorderContentItemMediaDto,
    userId: string,
  ) {
    await this.assertContentItemAccess(contentItemId, userId, false);
    await this.assertContentItemMutationAllowed(contentItemId, userId);

    const ids = dto.media.map(m => m.id);
    const existing = await this.prisma.contentItemMedia.findMany({
      where: { id: { in: ids }, contentItemId },
      select: { id: true },
    });

    if (existing.length !== ids.length) {
      throw new NotFoundException('Some media links not found');
    }

    await this.prisma.$transaction(
      dto.media.map(m =>
        this.prisma.contentItemMedia.update({
          where: { id: m.id },
          data: { order: m.order },
        }),
      ),
    );

    return { success: true };
  }
}
