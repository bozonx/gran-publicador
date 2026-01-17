import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ProjectRole, Prisma } from '../../generated/prisma/client.js';

import { DEFAULT_STALE_CHANNELS_DAYS } from '../../common/constants/global.constants.js';
import { PermissionsService } from '../../common/services/permissions.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateChannelDto, UpdateChannelDto } from './dto/index.js';

@Injectable()
export class ChannelsService {
  constructor(
    private prisma: PrismaService,
    private permissions: PermissionsService,
  ) {}

  /**
   * Creates a new channel within a project.
   * Requires OWNER, ADMIN, or EDITOR role in the project.
   */
  public async create(
    userId: string,
    projectId: string,
    data: Omit<CreateChannelDto, 'projectId'>,
  ) {
    await this.permissions.checkProjectPermission(projectId, userId, [
      ProjectRole.ADMIN,
      ProjectRole.EDITOR,
    ]);

    return this.prisma.channel.create({
      data: {
        projectId,
        socialMedia: data.socialMedia,
        name: data.name,
        description: data.description,
        channelIdentifier: data.channelIdentifier,
        language: data.language,
        credentials: (data.credentials ?? {}) as any,
        preferences: (data.preferences ?? {}) as any,
        isActive: data.isActive ?? true,
      },
    });
  }

  /**
   * Retrieves all channels for a given project.
   */
  public async findAllForProject(
    projectId: string,
    userId: string,
    options: { allowArchived?: boolean; isActive?: boolean; limit?: number } = {},
  ) {
    await this.permissions.checkProjectAccess(projectId, userId);

    const publishedPostFilter = { status: 'PUBLISHED' as const };

    const channels = await this.prisma.channel.findMany({
      where: {
        projectId,
        ...(options.allowArchived ? {} : { archivedAt: null }),
        ...(options.isActive !== undefined ? { isActive: options.isActive } : {}),
      },
      include: {
        project: {
          select: { id: true, name: true, archivedAt: true, preferences: true, ownerId: true },
        },
        posts: {
          where: { ...publishedPostFilter, publication: { archivedAt: null } },
          take: 1,
          orderBy: { publishedAt: 'desc' },
          select: { publishedAt: true, createdAt: true, id: true, publicationId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      ...(options.limit ? { take: options.limit } : {}),
    });

    const channelIds = channels.map(c => c.id);
    const postCounts = await this.prisma.post.groupBy({
      by: ['channelId', 'status'],
      where: {
        channelId: { in: channelIds },
        status: { in: ['PUBLISHED', 'FAILED'] },
      },
      _count: {
        id: true,
      },
    });

    const countsMap = new Map<string, { published: number; failed: number }>();
    postCounts.forEach(pc => {
      const current = countsMap.get(pc.channelId) || { published: 0, failed: 0 };
      if (pc.status === 'PUBLISHED') current.published = pc._count.id;
      if (pc.status === 'FAILED') current.failed = pc._count.id;
      countsMap.set(pc.channelId, current);
    });

    return channels.map((channel) =>
      this.mapToDto(channel, countsMap.get(channel.id)),
    );
  }

  /**
   * Retrieves all channels for a given user across all projects.
   */
  public async findAllForUser(
    userId: string,
    filters: {
      search?: string;
      ownership?: 'all' | 'own' | 'guest';
      issueType?: 'all' | 'noCredentials' | 'failedPosts' | 'stale' | 'inactive';
      socialMedia?: string;
      language?: string;
      sortBy?: 'alphabetical' | 'socialMedia' | 'language' | 'postsCount';
      sortOrder?: 'asc' | 'desc';
      limit?: number;
      offset?: number;
      includeArchived?: boolean;
      projectIds?: string[];
    } = {},
  ) {
    const validatedLimit = Math.min(filters.limit || 50, 1000);
    const offset = filters.offset || 0;

    const userProjects = await this.prisma.project.findMany({
      where: {
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      select: { id: true },
    });
    const userAllowedProjectIds = userProjects.map(p => p.id);

    if (userAllowedProjectIds.length === 0) return { items: [], total: 0 };

    let searchProjectIds = userAllowedProjectIds;
    if (filters.projectIds && filters.projectIds.length > 0) {
      searchProjectIds = filters.projectIds.filter(id => userAllowedProjectIds.includes(id));
      if (searchProjectIds.length === 0) return { items: [], total: 0 };
    }

    const where: any = {
      projectId: { in: searchProjectIds },
      ...(filters.includeArchived ? {} : { archivedAt: null, project: { archivedAt: null } }),
    };

    const andConditions: any[] = [];
    if (filters.search) {
      andConditions.push({
        OR: [
          { name: { contains: filters.search } },
          { channelIdentifier: { contains: filters.search } },
        ],
      });
    }

    if (filters.socialMedia) where.socialMedia = filters.socialMedia;
    if (filters.language) where.language = filters.language;

    if (filters.issueType === 'inactive') where.isActive = false;
    else if (filters.issueType === 'noCredentials') {
      andConditions.push({
        OR: [{ credentials: { equals: {} } }, { credentials: { equals: Prisma.AnyNull } }],
      });
    } else if (filters.issueType === 'failedPosts') {
      where.posts = { some: { status: 'FAILED' } };
    } else if (filters.issueType === 'stale') {
      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - DEFAULT_STALE_CHANNELS_DAYS);
      where.posts = { none: { status: 'PUBLISHED', publishedAt: { gt: staleDate } } };
    }

    if (andConditions.length > 0) where.AND = andConditions;

    const orderBy: any[] = [];
    const sortField = filters.sortBy || 'alphabetical';
    const sortOrder = filters.sortOrder || 'asc';
    if (sortField === 'alphabetical') orderBy.push({ name: sortOrder });
    else if (sortField === 'socialMedia') orderBy.push({ socialMedia: sortOrder }, { name: 'asc' });
    else if (sortField === 'language') orderBy.push({ language: sortOrder }, { name: 'asc' });
    else if (sortField === 'postsCount') orderBy.push({ posts: { _count: sortOrder } });

    const [channels, total] = await Promise.all([
      this.prisma.channel.findMany({
        where,
        include: {
          project: {
            select: { id: true, name: true, archivedAt: true, preferences: true, ownerId: true },
          },
          posts: {
            where: { status: 'PUBLISHED', publication: { archivedAt: null } },
            take: 1,
            orderBy: { publishedAt: 'desc' },
            select: { publishedAt: true, createdAt: true, id: true, publicationId: true },
          },
          _count: { select: { posts: { where: { status: 'PUBLISHED' } } } },
        },
        orderBy,
        take: validatedLimit,
        skip: offset,
      }),
      this.prisma.channel.count({ where }),
    ]);

    const channelIds = channels.map(c => c.id);
    const failedPostCounts =
      channelIds.length > 0
        ? await this.prisma.post.groupBy({
            by: ['channelId'],
            where: { channelId: { in: channelIds }, status: 'FAILED' },
            _count: { id: true },
          })
        : [];

    const failedCountsMap = new Map<string, number>();
    failedPostCounts.forEach(pc => failedCountsMap.set(pc.channelId, pc._count.id));

    const items = channels.map((channel) => {
      const failed = failedCountsMap.get(channel.id) || 0;
      return this.mapToDto(channel, {
        published: channel._count.posts,
        failed,
      });
    });

    return { items, total };
  }

  public async findArchivedForProject(projectId: string, userId: string) {
    await this.permissions.checkProjectAccess(projectId, userId);
    const channels = await this.prisma.channel.findMany({
      where: { projectId, archivedAt: { not: null } },
      include: {
        project: {
          select: { id: true, name: true, archivedAt: true, preferences: true, ownerId: true },
        },
        posts: {
          where: { status: 'PUBLISHED', publication: { archivedAt: null } },
          take: 1,
          orderBy: { publishedAt: 'desc' },
          select: { publishedAt: true, createdAt: true, id: true, publicationId: true },
        },
      },
      orderBy: { archivedAt: 'desc' },
    });

    return channels.map((channel) => this.mapToDto(channel));
  }

  public async findArchivedForUser(userId: string) {
    const channels = await this.prisma.channel.findMany({
      where: {
        project: { members: { some: { userId } }, archivedAt: null },
        archivedAt: { not: null },
      },
      include: {
        project: {
          select: { id: true, name: true, archivedAt: true, preferences: true, ownerId: true },
        },
        posts: {
          where: { status: 'PUBLISHED', publication: { archivedAt: null } },
          take: 1,
          orderBy: { publishedAt: 'desc' },
          select: { publishedAt: true, createdAt: true, id: true, publicationId: true },
        },
      },
      orderBy: { archivedAt: 'desc' },
    });

    return channels.map((channel) => this.mapToDto(channel));
  }

  public async findOne(id: string, userId: string, allowArchived = false) {
    const channel = await this.prisma.channel.findUnique({
      where: { id, ...(allowArchived ? {} : { archivedAt: null }) },
      include: {
        project: {
          select: { id: true, name: true, archivedAt: true, preferences: true, ownerId: true },
        },
        posts: {
          where: { status: 'PUBLISHED', publication: { archivedAt: null } },
          take: 1,
          orderBy: { publishedAt: 'desc' },
          select: { publishedAt: true, createdAt: true, id: true, publicationId: true },
        },
      },
    });

    if (!channel) throw new NotFoundException('Channel not found');

    const role = await this.permissions.getUserProjectRole(
      channel.projectId,
      userId,
    );

    const pc = await this.prisma.post.groupBy({
      by: ['status'],
      where: { channelId: id, status: { in: ['PUBLISHED', 'FAILED'] } },
      _count: { id: true },
    });

    const publishedCount =
      pc.find((p) => p.status === 'PUBLISHED')?._count.id || 0;
    const failedCount = pc.find((p) => p.status === 'FAILED')?._count.id || 0;

    return this.mapToDto(
      channel,
      { published: publishedCount, failed: failedCount },
      role || undefined,
    );
  }

  public async update(id: string, userId: string, data: UpdateChannelDto) {
    const channel = await this.findOne(id, userId, true);
    await this.permissions.checkProjectPermission(channel.projectId, userId, [
      ProjectRole.ADMIN,
      ProjectRole.EDITOR,
    ]);

    return this.prisma.channel.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        channelIdentifier: data.channelIdentifier,
        credentials: data.credentials ? (data.credentials as any) : undefined,
        preferences: data.preferences ? (data.preferences as any) : undefined,
        isActive: data.isActive,
        tags: data.tags,
        language: data.language,
      },
    });
  }

  public async remove(id: string, userId: string) {
    const channel = await this.findOne(id, userId, true);
    await this.permissions.checkProjectPermission(channel.projectId, userId, [ProjectRole.ADMIN]);

    return this.prisma.$transaction(async (tx) => {
      // 1. Находим все публикации, связанные с этим каналом
      const linkedPublications = await tx.post.findMany({
        where: { channelId: id },
        select: { publicationId: true },
        distinct: ['publicationId'],
      });

      const linkedPubIds = linkedPublications.map((p) => p.publicationId);

      if (linkedPubIds.length > 0) {
        // 2. Проверяем, какие из этих публикаций имеют посты в ДРУГИХ каналах
        const multiChannelPosts = await tx.post.findMany({
          where: {
            publicationId: { in: linkedPubIds },
            channelId: { not: id },
          },
          select: { publicationId: true },
          distinct: ['publicationId'],
        });

        const multiChannelPubIds = new Set(multiChannelPosts.map((p) => p.publicationId));

        // 3. Выявляем "сирот" (публикации, которые есть только в удаляемом канале)
        const pubsToDelete = linkedPubIds.filter((pid) => !multiChannelPubIds.has(pid));

        // 4. Удаляем сирот
        if (pubsToDelete.length > 0) {
          await tx.publication.deleteMany({
            where: { id: { in: pubsToDelete } },
          });
        }
      }

      // 5. Удаляем сам канал (Posts и AuthorSignatures удалятся каскадно благодаря схеме БД)
      return tx.channel.delete({ where: { id } });
    });
  }

  public async archive(id: string, userId: string) {
    const channel = await this.findOne(id, userId);
    await this.permissions.checkProjectPermission(channel.projectId, userId, [
      ProjectRole.ADMIN,
      ProjectRole.EDITOR,
    ]);

    return this.prisma.channel.update({
      where: { id },
      data: { archivedAt: new Date(), archivedBy: userId },
    });
  }

  public async unarchive(id: string, userId: string) {
    const channel = await this.findOne(id, userId, true);
    await this.permissions.checkProjectPermission(channel.projectId, userId, [
      ProjectRole.ADMIN,
      ProjectRole.EDITOR,
    ]);

    return this.prisma.channel.update({
      where: { id },
      data: { archivedAt: null, archivedBy: null },
    });
  }

  private mapToDto(
    channel: any,
    counts: { published: number; failed: number } = { published: 0, failed: 0 },
    role?: string,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { posts, credentials, preferences, project, _count, ...channelData } =
      channel;
    const channelPrefs = (preferences as any) || {};
    const projectPrefs = (project?.preferences as any) || {};
    const lastPostAt = posts?.[0]?.publishedAt || posts?.[0]?.createdAt || null;

    let isStale = false;
    if (lastPostAt && !channelData.archivedAt) {
      const staleDays =
        (channelPrefs.staleChannelsDays as number) ||
        (projectPrefs.staleChannelsDays as number) ||
        DEFAULT_STALE_CHANNELS_DAYS;
      const diffDays = Math.ceil(
        Math.abs(Date.now() - new Date(lastPostAt).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      isStale = diffDays > staleDays;
    }

    return {
      ...channelData,
      project,
      credentials: (credentials as any) || {},
      role: role?.toLowerCase(),
      postsCount: counts.published,
      failedPostsCount: counts.failed,
      lastPostAt,
      lastPostId: posts?.[0]?.id || null,
      lastPublicationId: posts?.[0]?.publicationId || null,
      isStale,
      preferences: channelPrefs,
    };
  }
}
