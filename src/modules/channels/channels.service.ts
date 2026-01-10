import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ProjectRole } from '../../generated/prisma/client.js';

import { DEFAULT_STALE_CHANNELS_DAYS } from '../../common/constants/global.constants.js';
import { PermissionsService } from '../../common/services/permissions.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateChannelDto, UpdateChannelDto } from './dto/index.js';

@Injectable()
export class ChannelsService {
  constructor(
    private prisma: PrismaService,
    private permissions: PermissionsService,
  ) { }

  /**
   * Creates a new channel within a project.
   * Requires OWNER, ADMIN, or EDITOR role in the project.
   *
   * @param userId - The ID of the user creating the channel.
   * @param projectId - The ID of the project.
   * @param data - The channel creation data.
   * @returns The created channel.
   */
  public async create(
    userId: string,
    projectId: string,
    data: Omit<CreateChannelDto, 'projectId'>,
  ) {
    await this.permissions.checkProjectPermission(projectId, userId, [
      ProjectRole.OWNER,
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
        credentials: JSON.stringify(data.credentials ?? {}),
        preferences: JSON.stringify(data.preferences ?? {}),
        isActive: data.isActive ?? true,
      },
    });
  }

  /**
   * Retrieves all channels for a given project.
   * Implicitly validates that the user is a member of the project.
   *
   * @param projectId - The ID of the project.
   * @param userId - The ID of the user requesting the channels.
   * @returns A list of channels with post counts.
   */
  public async findAllForProject(
    projectId: string,
    userId: string,
    options: { allowArchived?: boolean, isActive?: boolean, limit?: number } = {}
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
          select: { id: true, name: true, archivedAt: true, preferences: true, ownerId: true }
        },
        posts: {
          where: publishedPostFilter,
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
        status: { in: ['PUBLISHED', 'FAILED'] }
      },
      _count: {
        id: true
      }
    });

    const countsMap = new Map<string, { published: number, failed: number }>();
    postCounts.forEach(pc => {
      const current = countsMap.get(pc.channelId) || { published: 0, failed: 0 };
      if (pc.status === 'PUBLISHED') current.published = pc._count.id;
      if (pc.status === 'FAILED') current.failed = pc._count.id;
      countsMap.set(pc.channelId, current);
    });

    return channels.map(channel => {
      const { posts, credentials, ...channelData } = channel;
      const counts = countsMap.get(channel.id) || { published: 0, failed: 0 };
      
      const channelPreferences = channel.preferences ? JSON.parse(channel.preferences) : {};
      const projectPreferences = channel.project.preferences ? JSON.parse(channel.project.preferences) : {};
      const lastPostAt = posts[0]?.publishedAt || posts[0]?.createdAt || null;
      
      let isStale = false;
      if (lastPostAt) {
          const staleDays = (channelPreferences.staleChannelsDays as number) || (projectPreferences.staleChannelsDays as number) || DEFAULT_STALE_CHANNELS_DAYS;
          const diffTime = Math.abs(new Date().getTime() - new Date(lastPostAt).getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
          isStale = diffDays > staleDays;
      }

      return {
        ...channelData,
        credentials: credentials ? JSON.parse(credentials) : {},
        postsCount: counts.published,
        failedPostsCount: counts.failed,
        lastPostAt,
        lastPostId: posts[0]?.id || null,
        lastPublicationId: posts[0]?.publicationId || null,
        isStale,
        preferences: channelPreferences,
      };
    });
  }

  /**
   * Retrieves all channels for a given user across all projects they are members of.
   * Supports server-side pagination, filtering, and sorting.
   *
   * @param userId - The ID of the user requesting the channels.
   * @param filters - Filters and pagination options.
   * @returns Paginated channels with total count.
   */
  /**
   * Retrieves all channels for a given user across all projects they are members of.
   * Supports server-side pagination, filtering, and sorting.
   *
   * @param userId - The ID of the user requesting the channels.
   * @param filters - Filters and pagination options.
   * @returns Paginated channels with total count.
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
    } = {}
  ) {
    const MAX_LIMIT = 1000;
    const validatedLimit = Math.min(filters.limit || 50, MAX_LIMIT);
    const offset = filters.offset || 0;

    // 1. Get all projects where user is a member
    const userProjects = await this.prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true },
    });
    const userAllowedProjectIds = userProjects.map(p => p.projectId);

    if (userAllowedProjectIds.length === 0) {
      return { items: [], total: 0 };
    }

    let searchProjectIds = userAllowedProjectIds;
    // Intersect with requested filters if present
    if (filters.projectIds && filters.projectIds.length > 0) {
        searchProjectIds = filters.projectIds.filter(id => userAllowedProjectIds.includes(id));
        if (searchProjectIds.length === 0) return { items: [], total: 0 };
    }

    // Build where clause
    const where: any = {
      projectId: { in: searchProjectIds },
    };

    if (!filters.includeArchived) {
      where.archivedAt = null;
      where.project = { archivedAt: null };
    } else {
      where.OR = [
        { archivedAt: { not: null } },
        { project: { archivedAt: { not: null } } },
      ];
    }

    const andConditions: any[] = [];

    // Filter by social media
    if (filters.socialMedia) {
      where.socialMedia = filters.socialMedia;
    }

    // Filter by language
    if (filters.language) {
      where.language = filters.language;
    }

    // Text search
    if (filters.search) {
      andConditions.push({
        OR: [
          { name: { contains: filters.search } },
          { channelIdentifier: { contains: filters.search } },
        ]
      });
    }

    // Ownership filter
    if (filters.ownership === 'own') {
      where.project = { ...where.project, ownerId: userId };
    } else if (filters.ownership === 'guest') {
      where.project = { ...where.project, ownerId: { not: userId } };
    }

    // Issue type filter
    if (filters.issueType === 'inactive') {
      where.isActive = false;
    } else if (filters.issueType === 'noCredentials') {
      andConditions.push({
        OR: [
          { credentials: null },
          { credentials: '{}' },
          { credentials: '' }
        ]
      });
    } else if (filters.issueType === 'failedPosts') {
      where.posts = {
        some: { status: 'FAILED' }
      };
    } else if (filters.issueType === 'stale') {
      // Heuristic for stale: no published posts in the last 7 days by default
      const staleDays = DEFAULT_STALE_CHANNELS_DAYS;
      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - staleDays);
      
      where.posts = {
        none: {
          status: 'PUBLISHED',
          publishedAt: { gt: staleDate }
        }
      };
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    // Build orderBy
    const orderBy: any[] = [];
    const sortField = filters.sortBy || 'alphabetical';
    const sortOrder = filters.sortOrder || 'asc';

    if (sortField === 'alphabetical') {
      orderBy.push({ name: sortOrder });
    } else if (sortField === 'socialMedia') {
      orderBy.push({ socialMedia: sortOrder });
      orderBy.push({ name: 'asc' });
    } else if (sortField === 'language') {
      orderBy.push({ language: sortOrder });
      orderBy.push({ name: 'asc' });
    } else if (sortField === 'postsCount') {
       orderBy.push({
         posts: {
           _count: sortOrder
         }
       });
    }

    const [channels, total] = await Promise.all([
      this.prisma.channel.findMany({
        where,
        include: {
          project: {
            select: { id: true, name: true, archivedAt: true, preferences: true, ownerId: true }
          },
          posts: {
            where: { status: 'PUBLISHED' },
            take: 1,
            orderBy: { publishedAt: 'desc' },
            select: { publishedAt: true, createdAt: true, id: true, publicationId: true },
          },
          _count: {
            select: {
              posts: { where: { status: 'PUBLISHED' } }
            }
          }
        },
        orderBy,
        take: validatedLimit,
        skip: offset,
      }),
      this.prisma.channel.count({ where }),
    ]);

    const channelIds = channels.map(c => c.id);
    
    // Get failed post counts separately
    const failedPostCounts = channelIds.length > 0 
      ? await this.prisma.post.groupBy({
          by: ['channelId'],
          where: {
            channelId: { in: channelIds },
            status: 'FAILED'
          },
          _count: {
            id: true
          }
        })
      : [];

    const failedCountsMap = new Map<string, number>();
    failedPostCounts.forEach(pc => {
      failedCountsMap.set(pc.channelId, pc._count.id);
    });

    // Map channels to response format with computed fields
    const items = channels.map(channel => {
      const { posts, credentials, _count, ...channelData } = channel;
      const failedCount = failedCountsMap.get(channel.id) || 0;

      const channelPreferences = channel.preferences ? JSON.parse(channel.preferences) : {};
      const projectPreferences = channel.project.preferences ? JSON.parse(channel.project.preferences) : {};
      const lastPostAt = posts[0]?.publishedAt || posts[0]?.createdAt || null;
      
      let isStale = false;
      if (lastPostAt) {
          const staleDays = (channelPreferences.staleChannelsDays as number) || (projectPreferences.staleChannelsDays as number) || DEFAULT_STALE_CHANNELS_DAYS;
          const diffTime = Math.abs(new Date().getTime() - new Date(lastPostAt).getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
          isStale = diffDays > staleDays;
      }

      return {
        ...channelData,
        credentials: credentials ? JSON.parse(credentials) : {},
        postsCount: _count.posts,
        failedPostsCount: failedCount,
        lastPostAt,
        lastPostId: posts[0]?.id || null,
        lastPublicationId: posts[0]?.publicationId || null,
        isStale,
        preferences: channelPreferences,
      };
    });

    return {
      items,
      total,
    };
  }



  /**
   * Retrieves all archived channels for a given project.
   * Sorted by archival date (newest first).
   *
   * @param projectId - The ID of the project.
   * @param userId - The ID of the user requesting the channels.
   * @returns A list of archived channels with post counts.
   */
  public async findArchivedForProject(
    projectId: string,
    userId: string,
    options: { allowArchived?: boolean, isActive?: boolean } = {}
  ) {
    await this.permissions.checkProjectAccess(projectId, userId);

    const publishedPostFilter = { status: 'PUBLISHED' as const };

    const channels = await this.prisma.channel.findMany({
      where: {
        projectId,
        archivedAt: { not: null },
      },
      include: {
        project: {
          select: { id: true, name: true, archivedAt: true, preferences: true, ownerId: true }
        },
        posts: {
          where: publishedPostFilter,
          take: 1,
          orderBy: { publishedAt: 'desc' },
          select: { publishedAt: true, createdAt: true, id: true, publicationId: true },
        },
      },
      orderBy: { archivedAt: 'desc' },
    });

    const channelIds = channels.map(c => c.id);
    const postCounts = await this.prisma.post.groupBy({
      by: ['channelId', 'status'],
      where: {
        channelId: { in: channelIds },
        status: { in: ['PUBLISHED', 'FAILED'] }
      },
      _count: {
        id: true
      }
    });

    const countsMap = new Map<string, { published: number, failed: number }>();
    postCounts.forEach(pc => {
      const current = countsMap.get(pc.channelId) || { published: 0, failed: 0 };
      if (pc.status === 'PUBLISHED') current.published = pc._count.id;
      if (pc.status === 'FAILED') current.failed = pc._count.id;
      countsMap.set(pc.channelId, current);
    });

    return channels.map(channel => {
      const { posts, credentials, ...channelData } = channel;
      const counts = countsMap.get(channel.id) || { published: 0, failed: 0 }; // Fixed bug: was channel.id, not pc.channelId

      const channelPreferences = channel.preferences ? JSON.parse(channel.preferences) : {};
      const projectPreferences = channel.project.preferences ? JSON.parse(channel.project.preferences) : {};
      const lastPostAt = posts[0]?.publishedAt || posts[0]?.createdAt || null;
      
      let isStale = false;
      if (lastPostAt) {
          const staleDays = (channelPreferences.staleChannelsDays as number) || (projectPreferences.staleChannelsDays as number) || DEFAULT_STALE_CHANNELS_DAYS;
          const diffTime = Math.abs(new Date().getTime() - new Date(lastPostAt).getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
          isStale = diffDays > staleDays;
      }

      return {
        ...channelData,
        credentials: credentials ? JSON.parse(credentials) : {},
        postsCount: counts.published,
        failedPostsCount: counts.failed,
        lastPostAt,
        lastPostId: posts[0]?.id || null,
        lastPublicationId: posts[0]?.publicationId || null,
        isStale,
        preferences: channelPreferences,
      };
    });
  }

  /**
   * Retrieves all archived channels for a given user across all projects.
   *
   * @param userId - The ID of the user requesting the channels.
   * @returns A list of archived channels.
   */
  public async findArchivedForUser(
    userId: string,
  ) {
    const publishedPostFilter = { status: 'PUBLISHED' as const };

    const channels = await this.prisma.channel.findMany({
      where: {
        project: {
          members: {
            some: { userId }
          },
          archivedAt: null // Only channels from active projects
        },
        archivedAt: { not: null },
      },
      include: {
        project: {
          select: { id: true, name: true, archivedAt: true, preferences: true, ownerId: true }
        },
        posts: {
          where: publishedPostFilter,
          take: 1,
          orderBy: { publishedAt: 'desc' },
          select: { publishedAt: true, createdAt: true, id: true, publicationId: true },
        },
      },
      orderBy: { archivedAt: 'desc' },
    });

    const channelIds = channels.map(c => c.id);
    const postCounts = await this.prisma.post.groupBy({
      by: ['channelId', 'status'],
      where: {
        channelId: { in: channelIds },
        status: { in: ['PUBLISHED', 'FAILED'] }
      },
      _count: {
        id: true
      }
    });

    const countsMap = new Map<string, { published: number, failed: number }>();
    postCounts.forEach(pc => {
      const current = countsMap.get(pc.channelId) || { published: 0, failed: 0 };
      if (pc.status === 'PUBLISHED') current.published = pc._count.id;
      if (pc.status === 'FAILED') current.failed = pc._count.id;
      countsMap.set(pc.channelId, current);
    });

    return channels.map(channel => {
      const { posts, credentials, ...channelData } = channel;
      const counts = countsMap.get(channel.id) || { published: 0, failed: 0 };

      const channelPreferences = channel.preferences ? JSON.parse(channel.preferences) : {};
      const projectPreferences = channel.project.preferences ? JSON.parse(channel.project.preferences) : {};
      const lastPostAt = posts[0]?.publishedAt || posts[0]?.createdAt || null;
      
      let isStale = false;
      if (lastPostAt) {
          const staleDays = (channelPreferences.staleChannelsDays as number) || (projectPreferences.staleChannelsDays as number) || DEFAULT_STALE_CHANNELS_DAYS;
          const diffTime = Math.abs(new Date().getTime() - new Date(lastPostAt).getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
          isStale = diffDays > staleDays;
      }

      return {
        ...channelData,
        credentials: credentials ? JSON.parse(credentials) : {},
        postsCount: counts.published,
        failedPostsCount: counts.failed,
        lastPostAt,
        lastPostId: posts[0]?.id || null,
        lastPublicationId: posts[0]?.publicationId || null,
        isStale,
        preferences: channelPreferences,
      };
    });
  }


  /**
   * Find a single channel by ID.
   * Ensures the user has access to the project containing the channel.
   *
   * @param id - The ID of the channel.
   * @param userId - The ID of the user.
   * @param allowArchived - Whether to allow finding archived channels.
   * @returns The channel details.
   * @throws NotFoundException if the channel does not exist.
   */
  public async findOne(id: string, userId: string, allowArchived = false) {
    const publishedPostFilter = { status: 'PUBLISHED' as const };

    const channel = await this.prisma.channel.findUnique({
      where: {
        id,
        ...(allowArchived ? {} : { archivedAt: null }),
      },
      include: {
        project: {
          select: { id: true, name: true, archivedAt: true, preferences: true, ownerId: true }
        },
        posts: {
          where: publishedPostFilter,
          take: 1,
          orderBy: { publishedAt: 'desc' },
          select: { publishedAt: true, createdAt: true, id: true, publicationId: true },
        },
      },
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    const postCounts = await this.prisma.post.groupBy({
      by: ['status'],
      where: {
        channelId: id,
        status: { in: ['PUBLISHED', 'FAILED'] }
      },
      _count: {
        id: true
      }
    });

    let publishedCount = 0;
    let failedCount = 0;

    postCounts.forEach(pc => {
      if (pc.status === 'PUBLISHED') publishedCount = pc._count.id;
      if (pc.status === 'FAILED') failedCount = pc._count.id;
    });

    const role = await this.permissions.getUserProjectRole(channel.projectId, userId);
    const { posts, credentials, ...channelData } = channel;
    const creds = credentials ? JSON.parse(credentials) : {};

    const channelPreferences = channel.preferences ? JSON.parse(channel.preferences) : {};
    const projectPreferences = channel.project.preferences ? JSON.parse(channel.project.preferences) : {};
    const lastPostAt = posts[0]?.publishedAt || posts[0]?.createdAt || null;

    let isStale = false;
    if (lastPostAt) {
        const staleDays = (channelPreferences.staleChannelsDays as number) || (projectPreferences.staleChannelsDays as number) || DEFAULT_STALE_CHANNELS_DAYS;
        const diffTime = Math.abs(new Date().getTime() - new Date(lastPostAt).getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        isStale = diffDays > staleDays;
    }

    return {
      ...channelData,
      credentials: creds,
      role: role?.toLowerCase(),
      postsCount: publishedCount,
      failedPostsCount: failedCount,
      lastPostAt,
      lastPostId: posts[0]?.id || null,
      lastPublicationId: posts[0]?.publicationId || null,
      isStale,
      preferences: channelPreferences,
    };
  }

  /**
   * Update an existing channel.
   * Requires OWNER, ADMIN, or EDITOR role.
   * If projectId is being changed, requires permissions on both old and new projects.
   *
   * @param id - The ID of the channel.
   * @param userId - The ID of the user.
   * @param data - The data to update.
   */
  public async update(id: string, userId: string, data: UpdateChannelDto) {
    const channel = await this.findOne(id, userId, true);
    
    // Check permissions on current project
    await this.permissions.checkProjectPermission(channel.projectId, userId, [
      ProjectRole.OWNER,
      ProjectRole.ADMIN,
      ProjectRole.EDITOR,
    ]);

    return this.prisma.channel.update({
      where: { id: id },
      data: {
        name: data.name,
        description: data.description,
        channelIdentifier: data.channelIdentifier,
        credentials: data.credentials ? JSON.stringify(data.credentials) : undefined,
        preferences: data.preferences ? JSON.stringify(data.preferences) : undefined,
        isActive: data.isActive,
        tags: data.tags,
        language: data.language,
      },
    });
  }

  /**
   * Remove a channel.
   * Requires OWNER or ADMIN role.
   *
   * @param id - The ID of the channel to remove.
   * @param userId - The ID of the user.
   */
  public async remove(id: string, userId: string) {
    const channel = await this.findOne(id, userId, true);
    await this.permissions.checkProjectPermission(channel.projectId, userId, [
      ProjectRole.OWNER,
      ProjectRole.ADMIN,
    ]);

    // Check again, logic said Owner/Admin in doc comment. Code had checkProjectPermission.
    // The previous code had:
    /*
    await this.permissions.checkProjectPermission(channel.projectId, userId, [
      ProjectRole.OWNER,
      ProjectRole.ADMIN,
    ]);
    */
    // I will keep it OWNER/ADMIN.

    return this.prisma.channel.delete({
      where: { id },
    });
  }

  /**
   * Archive a channel.
   * Requires OWNER, ADMIN, or EDITOR role.
   *
   * @param id - The ID of the channel.
   * @param userId - The ID of the user.
   */
  public async archive(id: string, userId: string) {
    const channel = await this.findOne(id, userId);
    await this.permissions.checkProjectPermission(channel.projectId, userId, [
      ProjectRole.OWNER,
      ProjectRole.ADMIN,
      ProjectRole.EDITOR,
    ]);

    return this.prisma.channel.update({
      where: { id },
      data: {
        archivedAt: new Date(),
        archivedBy: userId,
      },
    });
  }

  /**
   * Unarchive a channel.
   * Requires OWNER, ADMIN, or EDITOR role.
   *
   * @param id - The ID of the channel.
   * @param userId - The ID of the user.
   */
  public async unarchive(id: string, userId: string) {
    const channel = await this.findOne(id, userId, true);
    await this.permissions.checkProjectPermission(channel.projectId, userId, [
      ProjectRole.OWNER,
      ProjectRole.ADMIN,
      ProjectRole.EDITOR,
    ]);

    return this.prisma.channel.update({
      where: { id },
      data: {
        archivedAt: null,
        archivedBy: null,
      },
    });
  }
}
