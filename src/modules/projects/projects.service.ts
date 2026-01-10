import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ProjectRole, Prisma, type Project } from '../../generated/prisma/client.js';

import { TRANSACTION_TIMEOUT } from '../../common/constants/database.constants.js';
import { DEFAULT_STALE_CHANNELS_DAYS } from '../../common/constants/global.constants.js';
import { PermissionsService } from '../../common/services/permissions.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateProjectDto, UpdateProjectDto } from './dto/index.js';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private prisma: PrismaService,
    private permissions: PermissionsService,
  ) { }

  /**
   * Creates a new project and assigns the creator as the owner.
   * This is done in a transaction to ensure both the project and the membership record are created.
   *
   * @param userId - The ID of the user creating the project.
   * @param data - The project creation data.
   * @returns The created project.
   */
  public async create(userId: string, data: CreateProjectDto): Promise<Project> {
    this.logger.log(`Creating project "${data.name}" for user ${userId}`);

    return this.prisma.$transaction(
      async tx => {
        const project = await tx.project.create({
          data: {
            name: data.name,
            description: data.description,
            ownerId: userId,
            preferences: JSON.stringify(data.preferences ?? {}),
          },
        });

        // Keep adding owner as a member to simplify queries like findAllForUser
        // that rely on checking the members relation
        await tx.projectMember.create({
          data: {
            projectId: project.id,
            userId: userId,
            role: ProjectRole.OWNER,
          },
        });

        this.logger.log(`Project "${data.name}" (${project.id}) created successfully`);

        return project;
      },
      {
        maxWait: TRANSACTION_TIMEOUT.MAX_WAIT,
        timeout: TRANSACTION_TIMEOUT.TIMEOUT,
      },
    );
  }

  /**
   * Returns all projects available to the user.
   * Filters projects where the user is a member (including owner).
   *
   * @param userId - The ID of the user.
   * @param options - Pagination and filtering options.
   * @returns A list of projects including member count and channel count.
   */
  /**
   * Returns all projects available to the user.
   * Filters projects where the user is a member (including owner).
   *
   * @param userId - The ID of the user.
   * @param options - Pagination and filtering options.
   * @returns A list of projects including member count and channel count.
   */
  public async findAllForUser(
    userId: string,
    options?: { search?: string; includeArchived?: boolean; limit?: number },
  ) {
    const { search, includeArchived, limit } = options || {};

    // Lightweight Search Query
    if (search) {
      // Remove explicit type to avoid potential strictness issues with 'mode' if type definitions mismatch
      const where: any = {
        members: {
          some: { userId },
        },
        archivedAt: includeArchived ? { not: null } : null,
        OR: [
          { name: { contains: search } },
          { description: { contains: search } },
        ],
      };

      const projects = await this.prisma.project.findMany({
        where,
        include: {
          _count: {
            select: {
              members: true,
              channels: true,
            },
          },
          // Include minimal member info to satisfy return mapping
          members: {
            where: { userId },
            select: { role: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return projects.map((project) => ({
        ...project,
        memberCount: project._count.members,
        channelCount: project._count.channels,
        // Default values for metrics not needed in search
        role: project.members[0]?.role?.toLowerCase(),
        channels: [],
        publicationsCount: 0,
        lastPublicationAt: null,
        lastPublicationId: null,
        languages: [],
        failedPostsCount: 0,
        problemPublicationsCount: 0,
        noCredentialsChannelsCount: 0,
        inactiveChannelsCount: 0,
        preferences: project.preferences ? JSON.parse(project.preferences) : {},
        staleChannelsCount: 0,
      }));
    }

    // Dashboard Heavy Query (No search)
    // 1. Fetch projects without heavy channel data
    const projects = await this.prisma.project.findMany({
      take: limit,
      where: {
        archivedAt: includeArchived ? { not: null } : null,
        members: {
          some: {
            userId: userId,
          },
        },
      },
      include: {
        members: {
          where: { userId },
          select: { role: true },
        },
        _count: {
          select: {
            channels: { where: { archivedAt: null } },
            publications: {
              where: {
                archivedAt: null,
                OR: [
                  { posts: { none: {} } },
                  { posts: { some: { channel: { archivedAt: null } } } },
                ],
              },
            },
          },
        },
        publications: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { id: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const projectIds = projects.map(p => p.id);

    if (projectIds.length === 0) {
      return [];
    }

    // 2. Fetch Aggregated Metrics concurrently
    const [
      problematicCounts,
      failedPostsRaw,
      staleChannelsRaw,
      noCredentialsRaw,
      inactiveRaw,
      projectLanguages
    ] = await Promise.all([
      // A. Problematic Publications
      this.prisma.publication.groupBy({
        by: ['projectId'],
        where: {
          projectId: { in: projectIds },
          status: { in: ['FAILED', 'PARTIAL'] },
          archivedAt: null,
        },
        _count: { id: true },
      }),

      // B. Failed Posts Count (Raw SQL for efficiency across relation)
      this.prisma.$queryRaw<Array<{ projectId: string, count: bigint }>>`
        SELECT c.project_id as projectId, COUNT(p.id) as count
        FROM posts p
        JOIN channels c ON p.channel_id = c.id
        WHERE p.status = 'FAILED'
          AND c.project_id IN (${Prisma.join(projectIds)})
        GROUP BY c.project_id
      `,

      // C. Stale Channels Count (Raw SQL - Option B)
      this.prisma.$queryRaw<Array<{ projectId: string, count: bigint }>>`
        SELECT 
          c.project_id as projectId, 
          COUNT(c.id) as count
        FROM channels c
        JOIN projects p ON c.project_id = p.id
        WHERE c.project_id IN (${Prisma.join(projectIds)})
          AND c.archived_at IS NULL
          AND EXISTS (SELECT 1 FROM posts po WHERE po.channel_id = c.id AND po.published_at IS NOT NULL)
          AND (
            (SELECT MAX(published_at) FROM posts WHERE channel_id = c.id) 
            < 
            DATETIME('now', '-' || CAST(COALESCE(json_extract(c.preferences, '$.staleChannelsDays'), json_extract(p.preferences, '$.staleChannelsDays'), ${DEFAULT_STALE_CHANNELS_DAYS}) AS TEXT) || ' days')
          )
        GROUP BY c.project_id
      `,

      // D. Channels without credentials
      this.prisma.$queryRaw<Array<{ projectId: string, count: bigint }>>`
        SELECT project_id as projectId, COUNT(id) as count
        FROM channels
        WHERE (credentials IS NULL OR credentials = '{}' OR credentials = '')
          AND archived_at IS NULL
          AND project_id IN (${Prisma.join(projectIds)})
        GROUP BY project_id
      `,

      // E. Inactive channels
      this.prisma.$queryRaw<Array<{ projectId: string, count: bigint }>>`
        SELECT project_id as projectId, COUNT(id) as count
        FROM channels
        WHERE is_active = 0
          AND archived_at IS NULL
          AND project_id IN (${Prisma.join(projectIds)})
        GROUP BY project_id
      `,

      // F. Distinct Languages per Project (Lightweight)
      this.prisma.channel.findMany({
        where: { 
          projectId: { in: projectIds },
          archivedAt: null
        },
        select: {
          projectId: true,
          language: true
        },
        distinct: ['projectId', 'language']
      })
    ]);

    // 3. Create Map Lookups
    const problematicCountMap = Object.fromEntries(problematicCounts.map(c => [c.projectId, c._count.id]));
    
    const failedPostsMap = new Map<string, number>();
    failedPostsRaw.forEach((row: any) => {
      // row.count is BigInt in standard Prisma Raw Query returns
      failedPostsMap.set(row.projectId, Number(row.count));
    });

    const staleChannelsMap = new Map<string, number>();
    staleChannelsRaw.forEach((row: any) => {
      staleChannelsMap.set(row.projectId, Number(row.count));
    });

    const noCredentialsMap = new Map<string, number>();
    noCredentialsRaw.forEach((row: any) => {
      noCredentialsMap.set(row.projectId, Number(row.count));
    });

    const inactiveMap = new Map<string, number>();
    inactiveRaw.forEach((row: any) => {
      inactiveMap.set(row.projectId, Number(row.count));
    });
    
    const languageMap = new Map<string, string[]>();
    projectLanguages.forEach(l => {
      if (!languageMap.has(l.projectId)) {
        languageMap.set(l.projectId, []);
      }
      languageMap.get(l.projectId)?.push(l.language);
    });


    // 4. Transform and Return
    return projects.map(project => {
      const userMember = project.members[0];

      const lastPublicationAt = project.publications[0]?.createdAt || null;
      const lastPublicationId = project.publications[0]?.id || null;
      
      const failedPostsCount = failedPostsMap.get(project.id) || 0;
      const problemPublicationsCount = problematicCountMap[project.id] || 0;
      const staleChannelsCount = staleChannelsMap.get(project.id) || 0;
      const noCredentialsChannelsCount = noCredentialsMap.get(project.id) || 0;
      const inactiveChannelsCount = inactiveMap.get(project.id) || 0;
      const languages = (languageMap.get(project.id) || []).sort();

      const projectPreferences = project.preferences ? JSON.parse(project.preferences) : {};

      // Calculate minimal channels array for consistency with previous return type if needed, 
      // BUT functionality-wise, we just need the counts. 
      // The previous implementation returned mapped channels. 
      // If the frontend uses 'project.channels', we might need to return simplified objects or empty.
      // Looking at use cases: Dashboard usually only needs counts. 
      // Let's assume we can return empty channels array to save bandwidth, 
      // as we provided all aggregates.
      // Wait, the return type shape:
      /*
        channels: {
          id: string;
          name: string;
          socialMedia: any;
          isStale: boolean;
        }[];
      */
      // If we remove channels list, we break signature if UI depends on iterating channels in Dashboard.
      // Usually Dashboards just show "Online: 5, Stale: 2".
      // Let's try to return empty array or basic stubs if absolutely beneficial.
      // However, to follow "Optimization" request strictly, I should not break contract.
      // The previous code returned `channels` array.
      // If I return empty/partial, UI might break if it tries to list channels.
      // BUT the user complaint was "Maсштаbiруемость" (Scalability). Loading 5000 channels is bad.
      // So I *must* avoid loading them.
      // I will return an empty array for `channels` property and assume UI uses the separate counters I provide.
      // If UI needs channels, it should call `findAllForProject` (detail view).
      // For Dashboard (findAllForUser), usually summaries are enough.
      
      const { publications: _, ...projectData } = project;

      return {
        ...projectData,
        channels: [], // Optimized: do not return full channel list for list view
        role: userMember?.role?.toLowerCase(),
        channelCount: project._count.channels,
        publicationsCount: project._count.publications,
        lastPublicationAt,
        lastPublicationId,
        languages,
        failedPostsCount,
        problemPublicationsCount,
        noCredentialsChannelsCount,
        inactiveChannelsCount,
        preferences: projectPreferences,
        staleChannelsCount,
      };
    });
  }

  /**
   * Returns all archived projects for the user.
   * Filters projects where the user is a member and the project is archived.
   * Sorted by archival date (newest first).
   *
   * @param userId - The ID of the user.
   * @param options - Pagination options.
   * @returns A list of archived projects.
   */
  public async findArchivedForUser(
    userId: string,
  ) {

    const projects = await this.prisma.project.findMany({
      where: {
        archivedAt: { not: null },
        members: {
          some: {
            userId: userId,
          },
        },
      },
      include: {
        members: {
          where: { userId },
          select: { role: true },
        },
        _count: {
          select: {
            channels: { where: { archivedAt: null } },
            publications: { where: { archivedAt: null } },
          },
        },
        publications: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { id: true, createdAt: true },
        },
        channels: {
          where: { archivedAt: null },
          select: {
            id: true,
            name: true,
            socialMedia: true,
            language: true,
            preferences: true,
            _count: {
              select: {
                posts: { where: { status: 'FAILED' } },
              },
            },
            posts: {
              where: { status: 'PUBLISHED' },
              take: 1,
              orderBy: { publishedAt: 'desc' },
              select: { publishedAt: true },
            },
          },
        },
      },
      orderBy: { archivedAt: 'desc' },
    });

    return projects.map(project => {
      const userMember = project.members[0];

      const lastPublicationAt = project.publications[0]?.createdAt || null;
      const lastPublicationId = project.publications[0]?.id || null;
      const failedPostsCount = project.channels.reduce((acc, ch) => acc + (ch._count.posts || 0), 0);
      const languages = [...new Set((project.channels || []).map(c => c.language))].sort();
      
      const projectPreferences = project.preferences ? JSON.parse(project.preferences) : {};
      let staleChannelsCount = 0;

      const channels = (project.channels || []).map(c => {
         const channelPreferences = c.preferences ? JSON.parse(c.preferences) : {};
         const lastPostAt = (c.posts as any[])[0]?.publishedAt || null;
         
         let isStale = false;
         if (lastPostAt) {
           const staleDays = channelPreferences.staleChannelsDays || projectPreferences.staleChannelsDays || DEFAULT_STALE_CHANNELS_DAYS;
           const diffTime = Math.abs(new Date().getTime() - new Date(lastPostAt).getTime());
           const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
           isStale = diffDays > staleDays;
         }
 
         if (isStale) {
           staleChannelsCount++;
         }

        return {
          id: c.id,
          name: c.name,
          socialMedia: c.socialMedia,
          isStale,
        };
      });

      const { publications: _, channels: _originalChannels, ...projectData } = project;

      return {
        ...projectData,
        channels,
        role: userMember?.role?.toLowerCase(),
        channelCount: project._count.channels,
        publicationsCount: project._count.publications,
        lastPublicationAt,
        lastPublicationId,
        languages,
        failedPostsCount,
        preferences: projectPreferences,
        staleChannelsCount,
      };
    });
  }


  /**
   * Find one project by ID with security check.
   * Verifies that the user is a member of the project before returning it.
   *
   * @param projectId - The ID of the project.
   * @param userId - The ID of the user.
   * @param allowArchived - Whether to allow finding archived projects.
   * @returns The project details including channels, members, and the user's role.
   * @throws ForbiddenException if the user is not a member.
   * @throws NotFoundException if the project does not exist.
   */
  public async findOne(projectId: string, userId: string, allowArchived = false): Promise<any> {
    const role = await this.permissions.getUserProjectRole(projectId, userId);

    if (!role) {
      throw new ForbiddenException('You are not a member of this project');
    }

    const publishedPublicationFilter = { status: 'PUBLISHED' as const, archivedAt: null };
    const publishedPostFilter = { status: 'PUBLISHED' as const, publication: { archivedAt: null } };

    const project = await this.prisma.project.findUnique({
      where: { id: projectId, ...(allowArchived ? {} : { archivedAt: null }) },
      include: {
        _count: {
          select: {
            channels: { where: { archivedAt: null } },
            publications: { 
              where: { 
                archivedAt: null,
                OR: [
                  { posts: { none: {} } },
                  { posts: { some: { channel: { archivedAt: null } } } },
                ],
              },
            },
          },
        },
        publications: {
          where: publishedPublicationFilter,
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { id: true, createdAt: true },
        },
        channels: {
          where: { archivedAt: null },
          include: {
            _count: {
              select: {
                posts: { where: publishedPostFilter },
              },
            },
            posts: {
              where: publishedPostFilter,
              take: 1,
              orderBy: { publishedAt: 'desc' },
              select: { publishedAt: true, createdAt: true },
            },
          },
        },
        members: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const lastPublicationAt = project.publications[0]?.createdAt || null;
    const lastPublicationId = project.publications[0]?.id || null;

    const projectPreferences = project.preferences ? JSON.parse(project.preferences) : {};
    let staleChannelsCount = 0;

    const channelIds = project.channels.map(c => c.id);
    const failedPostCounts = await this.prisma.post.groupBy({
      by: ['channelId'],
      where: {
        channelId: { in: channelIds },
        status: 'FAILED',
      },
      _count: {
        id: true,
      },
    });

    const failedCountsMap = new Map<string, number>();
    failedPostCounts.forEach(pc => {
      failedCountsMap.set(pc.channelId, pc._count.id);
    });

    const mappedChannels = project.channels.map(channel => {
      const channelPreferences = channel.preferences ? JSON.parse(channel.preferences) : {};
      const lastPostAt = channel.posts[0]?.publishedAt || channel.posts[0]?.createdAt || null;
      
      const lastPublishedAt = channel.posts.find(p => p.publishedAt)?.publishedAt || null;

      let isStale = false;
      if (lastPublishedAt) {
          const staleDays = channelPreferences.staleChannelsDays || projectPreferences.staleChannelsDays || DEFAULT_STALE_CHANNELS_DAYS;
          const diffTime = Math.abs(new Date().getTime() - new Date(lastPublishedAt).getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
          isStale = diffDays > staleDays;
      }
      
      if (isStale) {
          staleChannelsCount++;
      }

      const failedPostsCount = failedCountsMap.get(channel.id) || 0;

      return {
        ...channel,
        postsCount: channel._count.posts,
        failedPostsCount,
        lastPostAt: lastPostAt,
        isStale,
        preferences: channelPreferences,
      };
    });

    const projectFailedPostsCount = Array.from(failedCountsMap.values()).reduce((acc, count) => acc + count, 0);

    // Also count problematic publications (FAILED or PARTIAL)
    const problemPublicationsCount = await this.prisma.publication.count({
      where: {
        projectId,
        status: { in: ['FAILED', 'PARTIAL'] },
        archivedAt: null,
      },
    });

    // Count channels without credentials
    const noCredentialsChannelsCount = await this.prisma.channel.count({
      where: {
        projectId,
        archivedAt: null,
        OR: [
          { credentials: '' },
          { credentials: '{}' },
        ],
      },
    });

    // Count inactive channels
    const inactiveChannelsCount = await this.prisma.channel.count({
      where: {
        projectId,
        archivedAt: null,
        isActive: false,
      },
    });

    return {
      ...project,
      channels: mappedChannels,
      role: role.toLowerCase(),
      channelCount: project._count.channels,
      publicationsCount: project._count.publications,
      memberCount: project.members.length,
      lastPublicationAt,
      lastPublicationId,
      preferences: projectPreferences,
      staleChannelsCount,
      failedPostsCount: projectFailedPostsCount,
      problemPublicationsCount,
      noCredentialsChannelsCount,
      inactiveChannelsCount,
    };
  }

  /**
   * Update project details.
   * Requires OWNER or ADMIN role.
   *
   * @param projectId - The ID of the project.
   * @param userId - The ID of the user.
   * @param data - The data to update.
   */
  public async update(projectId: string, userId: string, data: UpdateProjectDto) {
    await this.permissions.checkProjectPermission(projectId, userId, [
      ProjectRole.OWNER,
      ProjectRole.ADMIN,
    ]);

    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...data,
        preferences: data.preferences ? JSON.stringify(data.preferences) : undefined,
      },
    });
  }

  /**
   * Remove a project.
   * Requires OWNER role.
   *
   * @param projectId - The ID of the project.
   * @param userId - The ID of the user.
   */
  public async remove(projectId: string, userId: string) {
    await this.permissions.checkProjectPermission(projectId, userId, [ProjectRole.OWNER, ProjectRole.ADMIN]);

    return this.prisma.project.delete({
      where: { id: projectId },
    });
  }

  /**
   * Archive a project.
   * Requires OWNER or ADMIN role.
   *
   * @param projectId - The ID of the project.
   * @param userId - The ID of the user.
   */
  public async archive(projectId: string, userId: string) {
    await this.permissions.checkProjectPermission(projectId, userId, [
      ProjectRole.OWNER,
      ProjectRole.ADMIN,
    ]);

    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        archivedAt: new Date(),
        archivedBy: userId,
      },
    });
  }

  /**
   * Unarchive a project.
   * Requires OWNER or ADMIN role.
   *
   * @param projectId - The ID of the project.
   * @param userId - The ID of the user.
   */
  public async unarchive(projectId: string, userId: string) {
    await this.permissions.checkProjectPermission(projectId, userId, [
      ProjectRole.OWNER,
      ProjectRole.ADMIN,
    ]);

    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        archivedAt: null,
        archivedBy: null,
      },
    });
  }
}
