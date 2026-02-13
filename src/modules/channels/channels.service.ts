import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/index.js';

import { DEFAULT_STALE_CHANNELS_DAYS } from '../../common/constants/global.constants.js';
import { PermissionsService } from '../../common/services/permissions.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateChannelDto, UpdateChannelDto, ChannelResponseDto } from './dto/index.js';
import { PermissionKey } from '../../common/types/permissions.types.js';

@Injectable()
export class ChannelsService {
  constructor(
    private prisma: PrismaService,
    private permissions: PermissionsService,
  ) {}

  private getJsonObject(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
  }

  private getChannelPreferences(value: unknown): {
    disableNotification?: boolean;
    protectContent?: boolean;
    staleChannelsDays?: number;
    templates?: Array<{
      id: string;
      name: string;
      order: number;
      isDefault?: boolean;
      projectTemplateId: string;
      excluded?: boolean;
      overrides?: Record<string, unknown>;
    }>;
  } {
    const prefs = this.getJsonObject(value);
    const templates = prefs.templates;

    return {
      disableNotification:
        typeof prefs.disableNotification === 'boolean' ? prefs.disableNotification : undefined,
      protectContent: typeof prefs.protectContent === 'boolean' ? prefs.protectContent : undefined,
      staleChannelsDays:
        typeof prefs.staleChannelsDays === 'number' ? prefs.staleChannelsDays : undefined,
      templates: Array.isArray(templates)
        ? templates
            .map(t => this.getJsonObject(t))
            .filter(t => typeof t.projectTemplateId === 'string')
            .map(t => ({
              id: typeof t.id === 'string' ? t.id : '',
              name: typeof t.name === 'string' ? t.name : '',
              order: typeof t.order === 'number' ? t.order : 0,
              isDefault: typeof t.isDefault === 'boolean' ? t.isDefault : undefined,
              projectTemplateId: t.projectTemplateId as string,
              excluded: typeof t.excluded === 'boolean' ? t.excluded : undefined,
              overrides: this.getJsonObject(t.overrides),
            }))
        : undefined,
    };
  }

  private async validateChannelTemplateReferences(
    projectId: string,
    preferences: unknown,
  ): Promise<void> {
    const templates = this.getChannelPreferences(preferences).templates;
    if (!templates || templates.length === 0) return;

    const ids = Array.from(new Set(templates.map(t => t.projectTemplateId)));
    if (ids.length === 0) return;

    const existing = await this.prisma.projectTemplate.findMany({
      where: {
        projectId,
        id: { in: ids },
      },
      select: { id: true },
    });

    const existingSet = new Set(existing.map(t => t.id));
    const missing = ids.filter(id => !existingSet.has(id));
    if (missing.length > 0) {
      throw new BadRequestException('Channel preferences contain unknown projectTemplateId');
    }
  }

  /**
   * Creates a new channel within a project.
   * Requires OWNER, ADMIN, or EDITOR role in the project.
   */
  public async create(
    userId: string,
    projectId: string,
    data: Omit<CreateChannelDto, 'projectId'>,
  ) {
    await this.permissions.checkPermission(projectId, userId, PermissionKey.CHANNELS_CREATE);

    if (data.preferences) {
      await this.validateChannelTemplateReferences(projectId, data.preferences);
    }

    return this.prisma.channel.create({
      data: {
        projectId,
        socialMedia: data.socialMedia,
        name: data.name,
        description: data.description,
        channelIdentifier: data.channelIdentifier,
        language: data.language ?? 'en-US',
        credentials: (data.credentials ?? {}) as Prisma.InputJsonValue,
        preferences: (data.preferences ?? {}) as Prisma.InputJsonValue,
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
  ): Promise<ChannelResponseDto[]> {
    await this.permissions.checkPermission(projectId, userId, PermissionKey.CHANNELS_READ);

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
      const current = countsMap.get(pc.channelId) ?? { published: 0, failed: 0 };
      if (pc.status === 'PUBLISHED') current.published = pc._count.id;
      if (pc.status === 'FAILED') current.failed = pc._count.id;
      countsMap.set(pc.channelId, current);
    });

    return channels.map(channel => this.mapToDto(channel, countsMap.get(channel.id)));
  }

  // ... (skip findAllForUser as it iterates projects)

  public async update(id: string, userId: string, data: UpdateChannelDto) {
    const channel = await this.findOne(id, userId, true);
    await this.permissions.checkPermission(
      channel.projectId,
      userId,
      PermissionKey.CHANNELS_UPDATE,
    );

    if (data.preferences) {
      await this.validateChannelTemplateReferences(channel.projectId, data.preferences);
    }

    return this.prisma.channel.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        channelIdentifier: data.channelIdentifier,
        credentials: data.credentials ? (data.credentials as Prisma.InputJsonValue) : undefined,
        preferences: data.preferences ? (data.preferences as Prisma.InputJsonValue) : undefined,
        isActive: data.isActive,
        tags: data.tags,
        language: data.language,
      },
    });
  }

  public async remove(id: string, userId: string) {
    const channel = await this.findOne(id, userId, true);
    await this.permissions.checkPermission(
      channel.projectId,
      userId,
      PermissionKey.CHANNELS_DELETE,
    );

    return this.prisma.$transaction(async tx => {
      // 1. Find all publications associated with this channel
      const linkedPublications = await tx.post.findMany({
        where: { channelId: id },
        select: { publicationId: true },
        distinct: ['publicationId'],
      });

      const linkedPubIds = linkedPublications.map(p => p.publicationId);

      if (linkedPubIds.length > 0) {
        // 2. Check which of these publications have posts in OTHER channels
        const multiChannelPosts = await tx.post.findMany({
          where: {
            publicationId: { in: linkedPubIds },
            channelId: { not: id },
          },
          select: { publicationId: true },
          distinct: ['publicationId'],
        });

        const multiChannelPubIds = new Set(multiChannelPosts.map(p => p.publicationId));

        // 3. Identify "orphans" (publications that exist only in the channel being deleted)
        const pubsToDelete = linkedPubIds.filter(pid => !multiChannelPubIds.has(pid));

        // 4. Delete orphans
        if (pubsToDelete.length > 0) {
          await tx.publication.deleteMany({
            where: { id: { in: pubsToDelete } },
          });
        }
      }

      // 5. Delete the channel itself (Posts will be deleted via cascade in DB schema)
      return tx.channel.delete({ where: { id } });
    });
  }

  public async archive(id: string, userId: string) {
    const channel = await this.findOne(id, userId);
    await this.permissions.checkPermission(
      channel.projectId,
      userId,
      PermissionKey.CHANNELS_UPDATE,
    );

    return this.prisma.channel.update({
      where: { id },
      data: { archivedAt: new Date(), archivedBy: userId },
    });
  }

  public async unarchive(id: string, userId: string) {
    const channel = await this.findOne(id, userId, true);
    await this.permissions.checkPermission(
      channel.projectId,
      userId,
      PermissionKey.CHANNELS_UPDATE,
    );

    return this.prisma.channel.update({
      where: { id },
      data: { archivedAt: null, archivedBy: null },
    });
  }

  /**
   * Retrieves all channels for a given user across all projects.
   */
  public async findAllForUser(
    userId: string,
    filters: {
      search?: string;
      ownership?: 'all' | 'own' | 'guest';
      issueType?: 'all' | 'noCredentials' | 'failedPosts' | 'stale' | 'inactive' | 'problematic';
      socialMedia?: string;
      language?: string;
      sortBy?: 'alphabetical' | 'socialMedia' | 'language' | 'postsCount';
      sortOrder?: 'asc' | 'desc';
      limit?: number;
      offset?: number;
      includeArchived?: boolean;
      archivedOnly?: boolean;
      projectIds?: string[];
    } = {},
  ): Promise<{ items: ChannelResponseDto[]; total: number; totalUnfiltered: number }> {
    const validatedLimit = Math.min(filters.limit ?? 50, 1000);
    const offset = filters.offset ?? 0;

    // Check if user is admin
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });

    const where: any = {};
    if (filters.archivedOnly) {
      where.OR = [{ archivedAt: { not: null } }, { project: { archivedAt: { not: null } } }];
    } else if (!filters.includeArchived) {
      where.archivedAt = null;
      where.project = { archivedAt: null };
    }

    if (!user?.isAdmin) {
      const projectWhere: any = {
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      };

      if (filters.ownership === 'own') {
        projectWhere.OR = [{ ownerId: userId }];
      } else if (filters.ownership === 'guest') {
        projectWhere.OR = [{ members: { some: { userId } }, ownerId: { not: userId } }];
      }

      const userProjects = await this.prisma.project.findMany({
        where: projectWhere,
        select: { id: true },
      });
      const userAllowedProjectIds = userProjects.map(p => p.id);

      if (userAllowedProjectIds.length === 0) return { items: [], total: 0, totalUnfiltered: 0 };

      if (filters.projectIds && filters.projectIds.length > 0) {
        const allowedIds = filters.projectIds.filter(id => userAllowedProjectIds.includes(id));
        if (allowedIds.length === 0) return { items: [], total: 0, totalUnfiltered: 0 };
        where.projectId = { in: allowedIds };
      } else {
        where.projectId = { in: userAllowedProjectIds };
      }
    } else {
      // Admin can see all, but filter if projectIds provided
      if (filters.projectIds && filters.projectIds.length > 0) {
        where.projectId = { in: filters.projectIds };
      }

      // If ownership filter is set for admin, we need to respect it relative to their own user ID
      if (filters.ownership) {
        if (filters.ownership === 'own') {
          // Projects owned by admin
          where.project = { ...where.project, ownerId: userId };
        } else if (filters.ownership === 'guest') {
          // Projects where admin is a member but not owner
          where.project = {
            ...where.project,
            ownerId: { not: userId },
            members: { some: { userId } },
          };
        }
      }
    }

    const andConditions: any[] = [];
    if (filters.search) {
      andConditions.push({
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { channelIdentifier: { contains: filters.search, mode: 'insensitive' } },
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
      andConditions.push({
        AND: [
          { posts: { some: { status: 'PUBLISHED' } } },
          { posts: { none: { status: 'PUBLISHED', publishedAt: { gt: staleDate } } } },
        ],
      });
    } else if (filters.issueType === 'problematic') {
      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - DEFAULT_STALE_CHANNELS_DAYS);

      const problemConditions: any[] = [
        // Inactive
        { isActive: false },
        // No credentials
        { OR: [{ credentials: { equals: {} } }, { credentials: { equals: Prisma.AnyNull } }] },
        // Failed posts
        { posts: { some: { status: 'FAILED' } } },
        // Stale
        {
          AND: [
            { posts: { some: { status: 'PUBLISHED' } } },
            { posts: { none: { status: 'PUBLISHED', publishedAt: { gt: staleDate } } } },
          ],
        },
      ];

      andConditions.push({ OR: problemConditions });
    }

    if (andConditions.length > 0) where.AND = andConditions;

    const orderBy: any[] = [];
    const sortField = filters.sortBy ?? 'alphabetical';
    const sortOrder = filters.sortOrder ?? 'asc';
    if (sortField === 'alphabetical') {
      orderBy.push({ name: sortOrder }, { id: 'asc' });
    } else if (sortField === 'socialMedia') {
      orderBy.push({ socialMedia: sortOrder }, { name: 'asc' }, { id: 'asc' });
    } else if (sortField === 'language') {
      orderBy.push({ language: sortOrder }, { name: 'asc' }, { id: 'asc' });
    } else if (sortField === 'postsCount') {
      orderBy.push({ posts: { _count: sortOrder } }, { name: 'asc' }, { id: 'asc' });
    } else {
      orderBy.push({ name: sortOrder }, { id: 'asc' });
    }

    const unfilteredWhere: any = { archivedAt: null, project: { archivedAt: null } };
    if (!user?.isAdmin) {
      unfilteredWhere.projectId = where.projectId;
      if (filters.ownership) {
        unfilteredWhere.project = { ...unfilteredWhere.project, ...where.project };
      }
    }

    const [channels, total, totalUnfiltered] = await Promise.all([
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
      this.prisma.channel.count({ where: unfilteredWhere }),
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

    const items = channels.map(channel => {
      const failed = failedCountsMap.get(channel.id) ?? 0;
      return this.mapToDto(channel, {
        published: channel._count.posts,
        failed,
      });
    });

    return { items, total, totalUnfiltered };
  }

  public async findArchivedForProject(
    projectId: string,
    userId: string,
  ): Promise<ChannelResponseDto[]> {
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

    return channels.map(channel => this.mapToDto(channel));
  }

  public async findArchivedForUser(userId: string): Promise<ChannelResponseDto[]> {
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

    return channels.map(channel => this.mapToDto(channel));
  }

  public async findOne(
    id: string,
    userId: string,
    allowArchived = false,
  ): Promise<ChannelResponseDto> {
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

    const role = await this.permissions.getUserProjectRole(channel.projectId, userId);

    const pc = await this.prisma.post.groupBy({
      by: ['status'],
      where: { channelId: id, status: { in: ['PUBLISHED', 'FAILED'] } },
      _count: { id: true },
    });

    const publishedCount = pc.find(p => p.status === 'PUBLISHED')?._count.id ?? 0;
    const failedCount = pc.find(p => p.status === 'FAILED')?._count.id ?? 0;

    return this.mapToDto(
      channel,
      { published: publishedCount, failed: failedCount },
      role ?? undefined,
    );
  }

  private mapToDto(
    channel: any,
    counts: { published: number; failed: number } = { published: 0, failed: 0 },
    role?: string,
  ): ChannelResponseDto {
    const { posts, credentials, preferences, project, _count, ...channelData } = channel;
    const channelPrefs = this.getChannelPreferences(preferences);
    const projectPrefs = this.getJsonObject(project?.preferences);
    const lastPostAt = posts?.[0]?.publishedAt ?? posts?.[0]?.createdAt ?? null;

    let isStale = false;
    if (lastPostAt && !channelData.archivedAt) {
      const staleDays =
        channelPrefs.staleChannelsDays ??
        (typeof projectPrefs.staleChannelsDays === 'number'
          ? projectPrefs.staleChannelsDays
          : undefined) ??
        DEFAULT_STALE_CHANNELS_DAYS;
      const diffDays = Math.ceil(
        Math.abs(Date.now() - new Date(lastPostAt).getTime()) / (1000 * 60 * 60 * 24),
      );
      isStale = diffDays > staleDays;
    }

    return {
      ...channelData,
      project,
      credentials: this.getJsonObject(credentials),
      role: role?.toLowerCase(),
      postsCount: counts.published,
      failedPostsCount: counts.failed,
      lastPostAt,
      lastPostId: posts?.[0]?.id ?? null,
      lastPublicationId: posts?.[0]?.publicationId ?? null,
      isStale,
      preferences: channelPrefs,
    };
  }
}
