import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { request } from 'undici';
import { NewsConfig } from '../../config/news.config.js';
import {
  Prisma,
  type Project,
  PublicationStatus,
  PostStatus,
} from '../../generated/prisma/index.js';

import { TRANSACTION_TIMEOUT } from '../../common/constants/database.constants.js';
import { DEFAULT_STALE_CHANNELS_DAYS } from '../../common/constants/global.constants.js';
import { PermissionsService } from '../../common/services/permissions.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateProjectDto, UpdateProjectDto, AddMemberDto, UpdateMemberDto } from './dto/index.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { RolesService } from '../roles/roles.service.js';
import { PermissionKey } from '../../common/types/permissions.types.js';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private prisma: PrismaService,
    private permissions: PermissionsService,
    private notifications: NotificationsService,
    private roles: RolesService,
    private readonly configService: ConfigService,
  ) {}

  private hasNoCredentials(creds: any, socialMedia?: string): boolean {
    if (!creds || typeof creds !== 'object') return true;

    // Platform-specific required fields
    if (socialMedia === 'TELEGRAM') {
      const { telegramBotToken, telegramChannelId } = creds;
      if (
        !telegramBotToken ||
        !telegramChannelId ||
        String(telegramBotToken).trim().length === 0 ||
        String(telegramChannelId).trim().length === 0
      ) {
        return true;
      }
    } else if (socialMedia === 'VK') {
      const { vkAccessToken } = creds;
      if (!vkAccessToken || String(vkAccessToken).trim().length === 0) {
        return true;
      }
    }

    // Default/Legacy check: Is it an empty object or has only empty values?
    const values = Object.values(creds);
    if (values.length === 0) return true;

    return values.every((v: any) => !v || String(v).trim().length === 0);
  }

  public async create(userId: string, data: CreateProjectDto): Promise<Project> {
    return this.prisma.$transaction(
      async tx => {
        const project = await tx.project.create({
          data: {
            name: data.name,
            description: data.description,
            ownerId: userId,
            preferences: (data.preferences ?? {}) as any,
          },
        });

        // Create default roles for the project
        await this.roles.createDefaultRoles(project.id, tx);

        this.logger.log(`Project "${project.name}" created by user ${userId}`);

        return project;
      },
      {
        maxWait: TRANSACTION_TIMEOUT.MAX_WAIT,
        timeout: TRANSACTION_TIMEOUT.TIMEOUT,
      },
    );
  }

  public async findAllForUser(
    userId: string,
    options?: { search?: string; includeArchived?: boolean; limit?: number },
  ) {
    const { search, includeArchived, limit } = options || {};

    const where: any = {
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      ...(includeArchived ? {} : { archivedAt: null }),
    };

    if (search) {
      where.OR = [{ name: { contains: search } }, { description: { contains: search } }];
    }

    const projects = await this.prisma.project.findMany({
      where,
      include: {
        _count: {
          select: {
            members: true,
            channels: { where: { archivedAt: null } },
            publications: { where: { archivedAt: null } },
          },
        },
        members: { where: { userId }, select: { role: { select: { name: true } } } },
        publications: {
          where: { archivedAt: null },
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { id: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const projectIds = projects.map(p => p.id);
    if (projectIds.length === 0) return [];

    const dbUrl = process.env.DATABASE_URL || '';
    const isPostgres = dbUrl.startsWith('postgres');

    const [
      problematicCounts,
      failedPostsRaw,
      staleChannelsRaw,
      noCredentialsRaw,
      inactiveRaw,
      projectLanguages,
    ] = await Promise.all([
      this.prisma.publication.groupBy({
        by: ['projectId'],
        where: {
          projectId: { in: projectIds },
          status: {
            in: [PublicationStatus.FAILED, PublicationStatus.PARTIAL, PublicationStatus.EXPIRED],
          },
          archivedAt: null,
        },
        _count: { id: true },
      }),
      this.prisma.post.groupBy({
        by: ['channelId'],
        where: {
          status: PostStatus.FAILED,
          channel: { projectId: { in: projectIds } },
          publication: { archivedAt: null },
        },
        _count: { id: true },
      }),
      isPostgres
        ? this.prisma.$queryRaw<Array<{ projectId: string; count: bigint }>>`
            SELECT c.project_id as "projectId", COUNT(c.id) as "count" FROM channels c JOIN projects p ON c.project_id = p.id
            WHERE c.project_id IN (${Prisma.join(projectIds)}) AND c.archived_at IS NULL
              AND EXISTS (SELECT 1 FROM posts po WHERE po.channel_id = c.id AND po.published_at IS NOT NULL)
              AND ( (SELECT MAX(published_at) FROM posts WHERE channel_id = c.id) < NOW() - (COALESCE((c.preferences->>'staleChannelsDays')::integer, (p.preferences->>'staleChannelsDays')::integer, ${DEFAULT_STALE_CHANNELS_DAYS}) || ' days')::interval )
            GROUP BY c.project_id`
        : this.prisma.$queryRaw<Array<{ projectId: string; count: bigint }>>`
            SELECT c.project_id as projectId, COUNT(c.id) as count FROM channels c JOIN projects p ON c.project_id = p.id
            WHERE c.project_id IN (${Prisma.join(projectIds)}) AND c.archived_at IS NULL
              AND EXISTS (SELECT 1 FROM posts po WHERE po.channel_id = c.id AND po.published_at IS NOT NULL)
              AND ( (SELECT MAX(published_at) FROM posts WHERE channel_id = c.id) < DATETIME('now', '-' || CAST(COALESCE(json_extract(c.preferences, '$.staleChannelsDays'), json_extract(p.preferences, '$.staleChannelsDays'), ${DEFAULT_STALE_CHANNELS_DAYS}) AS TEXT) || ' days') )
            GROUP BY c.project_id`,
      this.prisma.channel.findMany({
        where: {
          projectId: { in: projectIds },
          archivedAt: null,
        },
        select: { id: true, projectId: true, credentials: true, socialMedia: true }, // Select credentials and socialMedia to check manually
      }),
      this.prisma.channel.groupBy({
        by: ['projectId'],
        where: { projectId: { in: projectIds }, archivedAt: null, isActive: false },
        _count: { id: true },
      }),
      this.prisma.channel.findMany({
        where: { projectId: { in: projectIds }, archivedAt: null },
        select: { id: true, projectId: true, language: true },
      }),
    ]);

    const problematicCountMap = Object.fromEntries(
      problematicCounts.map(c => [c.projectId, c._count.id]),
    );

    const channelProjectMap = new Map<string, string>();
    const languageMap = new Map<string, string[]>();

    projectLanguages.forEach(l => {
      channelProjectMap.set(l.id, l.projectId);
      if (!languageMap.has(l.projectId)) languageMap.set(l.projectId, []);
      const langs = languageMap.get(l.projectId)!;
      if (!langs.includes(l.language)) langs.push(l.language);
    });

    const failedPostsMap = new Map<string, number>();
    failedPostsRaw.forEach((row: any) => {
      const projectId = channelProjectMap.get(row.channelId);
      if (projectId) {
        failedPostsMap.set(
          projectId,
          (failedPostsMap.get(projectId) || 0) + Number(row._count.id || 0),
        );
      }
    });

    const staleChannelsMap = new Map<string, number>();
    staleChannelsRaw.forEach((row: any) =>
      staleChannelsMap.set(row.projectId, Number(row.count || 0)),
    );

    const noCredentialsMap = new Map<string, number>();
    // Manually count credential problems
    // Manually count credential problems
    noCredentialsRaw.forEach((row: any) => {
      if (this.hasNoCredentials(row.credentials, row.socialMedia)) {
        noCredentialsMap.set(row.projectId, (noCredentialsMap.get(row.projectId) || 0) + 1);
      }
    });

    const inactiveMap = new Map<string, number>();
    inactiveRaw.forEach((row: any) => inactiveMap.set(row.projectId, Number(row._count.id || 0)));

    return projects.map(project => {
      const userMember = project.members.length > 0 ? project.members[0] : null;
      const lastPublicationAt = project.publications[0]?.createdAt || null;
      const lastPublicationId = project.publications[0]?.id || null;

      return {
        ...project,
        channels: [],
        role: project.ownerId === userId ? 'owner' : userMember?.role?.name?.toLowerCase(),
        channelCount: project._count.channels,
        publicationsCount: project._count.publications,
        lastPublicationAt,
        lastPublicationId,
        languages: (languageMap.get(project.id) || []).sort(),
        failedPostsCount: failedPostsMap.get(project.id) || 0,
        problemPublicationsCount: problematicCountMap[project.id] || 0,
        noCredentialsChannelsCount: noCredentialsMap.get(project.id) || 0,
        inactiveChannelsCount: inactiveMap.get(project.id) || 0,
        preferences: project.preferences || {},
        staleChannelsCount: staleChannelsMap.get(project.id) || 0,
      };
    });
  }

  public async findArchivedForUser(userId: string) {
    const projects = await this.prisma.project.findMany({
      where: {
        archivedAt: { not: null },
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      include: {
        members: { where: { userId }, select: { role: { select: { name: true } } } },
        _count: { select: { channels: true, publications: true } },
        publications: {
          where: { archivedAt: null },
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
            _count: { select: { posts: true } },
            posts: {
              where: { status: PostStatus.PUBLISHED, publication: { archivedAt: null } },
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
      const projectPrefs = (project.preferences as any) || {};
      let staleChannelsCount = 0;
      const mappedChannels = project.channels.map(c => {
        const channelPrefs = (c.preferences as any) || {};
        const lastPostAt = (c.posts as any[])[0]?.publishedAt || null;
        let isStale = false;
        if (lastPostAt) {
          const staleDays =
            channelPrefs.staleChannelsDays ||
            projectPrefs.staleChannelsDays ||
            DEFAULT_STALE_CHANNELS_DAYS;
          const diffDays = Math.ceil(
            Math.abs(Date.now() - new Date(lastPostAt).getTime()) / (1000 * 60 * 60 * 24),
          );
          isStale = diffDays > staleDays;
        }
        if (isStale) staleChannelsCount++;
        return { id: c.id, name: c.name, socialMedia: c.socialMedia, isStale };
      });

      return {
        ...project,
        channels: mappedChannels,
        role:
          project.ownerId === userId
            ? 'owner'
            : project.members.length > 0
              ? project.members[0].role?.name?.toLowerCase()
              : 'viewer',
        channelCount: project._count.channels,
        publicationsCount: project._count.publications,
        lastPublicationAt: project.publications[0]?.createdAt || null,
        lastPublicationId: project.publications[0]?.id || null,
        languages: [...new Set(project.channels.map(c => c.language))].sort(),
        failedPostsCount: 0,
        preferences: projectPrefs,
        staleChannelsCount,
      };
    });
  }

  public async findOne(projectId: string, userId: string, allowArchived = false): Promise<any> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ...(allowArchived ? {} : { archivedAt: null }) },
      include: {
        _count: {
          select: {
            channels: { where: { archivedAt: null } },
            publications: { where: { archivedAt: null } },
          },
        },
        publications: {
          where: { status: PublicationStatus.PUBLISHED, archivedAt: null },
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { id: true, createdAt: true },
        },
        channels: {
          where: { archivedAt: null },
          include: {
            _count: {
              select: {
                posts: {
                  where: { status: PostStatus.PUBLISHED, publication: { archivedAt: null } },
                },
              },
            },
            posts: {
              where: { status: PostStatus.PUBLISHED, publication: { archivedAt: null } },
              take: 1,
              orderBy: { publishedAt: 'desc' },
              select: { publishedAt: true, createdAt: true },
            },
          },
        },
        members: { include: { user: true } },
      },
    });

    if (!project) throw new NotFoundException('Project not found');

    const role = await this.permissions.getUserProjectRole(projectId, userId);
    if (!role) throw new ForbiddenException('You are not a member of this project');

    const projectPrefs = (project.preferences as any) || {};
    let staleChannelsCount = 0;
    const channelIds = project.channels.map(c => c.id);
    const failedPostCounts =
      channelIds.length > 0
        ? await this.prisma.post.groupBy({
            by: ['channelId'],
            where: {
              channelId: { in: channelIds },
              status: PostStatus.FAILED,
              publication: { archivedAt: null },
            },
            _count: { id: true },
          })
        : [];
    const failedCountsMap = new Map<string, number>();
    failedPostCounts.forEach(pc => failedCountsMap.set(pc.channelId, pc._count.id));

    const mappedChannels = project.channels.map(channel => {
      const channelPrefs = (channel.preferences as any) || {};
      const lastPublishedAt = channel.posts.find(p => (p as any).publishedAt)?.publishedAt || null;
      let isStale = false;
      if (lastPublishedAt) {
        const staleDays =
          channelPrefs.staleChannelsDays ||
          projectPrefs.staleChannelsDays ||
          DEFAULT_STALE_CHANNELS_DAYS;
        const diffDays = Math.ceil(
          Math.abs(Date.now() - new Date(lastPublishedAt).getTime()) / (1000 * 60 * 60 * 24),
        );
        isStale = diffDays > staleDays;
      }
      if (isStale) staleChannelsCount++;
      return {
        ...channel,
        postsCount: (channel as any)._count.posts,
        failedPostsCount: failedCountsMap.get(channel.id) || 0,
        lastPostAt:
          (channel as any).posts[0]?.publishedAt || (channel as any).posts[0]?.createdAt || null,
        isStale,
        preferences: channelPrefs,
      };
    });

    const [problemCount, inactiveCount] = await Promise.all([
      this.prisma.publication.count({
        where: {
          projectId,
          status: {
            in: [PublicationStatus.FAILED, PublicationStatus.PARTIAL, PublicationStatus.EXPIRED],
          },
          archivedAt: null,
        },
      }),
      // No credentials count calculated below from loaded channels
      this.prisma.channel.count({ where: { projectId, archivedAt: null, isActive: false } }),
    ]);

    return {
      ...project,
      channels: mappedChannels,
      role: role.toLowerCase(),
      channelCount: project._count.channels,
      publicationsCount: project._count.publications,
      memberCount: project.members.length,
      lastPublicationAt: project.publications[0]?.createdAt || null,
      lastPublicationId: project.publications[0]?.id || null,
      preferences: projectPrefs,
      staleChannelsCount,
      failedPostsCount: Array.from(failedCountsMap.values()).reduce((a, b) => a + b, 0),
      problemPublicationsCount: problemCount,
      // Calculate no credentials count from mapped channels
      noCredentialsChannelsCount: mappedChannels.filter(c =>
        this.hasNoCredentials(c.credentials, c.socialMedia),
      ).length,
      inactiveChannelsCount: inactiveCount,
    };
  }

  public async update(projectId: string, userId: string, data: UpdateProjectDto) {
    await this.permissions.checkPermission(projectId, userId, PermissionKey.PROJECT_UPDATE);
    
    return this.prisma.project.update({
      where: { id: projectId },
      data: { ...data, preferences: data.preferences ? (data.preferences as any) : undefined },
    });
  }

  public async remove(projectId: string, userId: string) {
    // TODO: Update to use new permission system
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    if (project.ownerId !== userId) throw new ForbiddenException('Only project owner can delete project');
    
    return this.prisma.project.delete({ where: { id: projectId } });
  }

  public async archive(projectId: string, userId: string) {
    // TODO: Update to use new permission system
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    if (project.ownerId !== userId) throw new ForbiddenException('Only project owner can archive project');
    
    return this.prisma.project.update({
      where: { id: projectId },
      data: { archivedAt: new Date(), archivedBy: userId },
    });
  }

  public async unarchive(projectId: string, userId: string) {
    // TODO: Update to use new permission system
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    if (project.ownerId !== userId) throw new ForbiddenException('Only project owner can unarchive project');
    
    return this.prisma.project.update({
      where: { id: projectId },
      data: { archivedAt: null, archivedBy: null },
    });
  }

  public async findMembers(projectId: string, userId: string) {
    // Any member can view members
    await this.permissions.checkProjectAccess(projectId, userId);

    const members = await this.prisma.projectMember.findMany({
      where: { projectId },
      include: { user: true, role: true },
    });

    // Manually fetch owner to append to the list (since OWNER role is removed from members table)
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { owner: true },
    });

    if (project && project.owner) {
      // Create a virtual member object for the owner
      // We cast to any to avoid type issues with the strictly generated ProjectMember type
      const ownerMember: any = {
        id: 'owner',
        projectId: project.id,
        userId: project.ownerId,
        role: 'OWNER', // Virtual role
        createdAt: project.createdAt,
        user: project.owner,
      };
      return [ownerMember, ...members];
    }

    return members;
  }

  public async addMember(projectId: string, userId: string, data: AddMemberDto) {
    await this.permissions.checkPermission(projectId, userId, PermissionKey.PROJECT_UPDATE);

    let userToAdd;

    // Check if input is a Telegram ID (numeric)
    if (/^\d+$/.test(data.username)) {
      userToAdd = await this.prisma.user.findUnique({
        where: { telegramId: BigInt(data.username) },
      });
    } else {
      userToAdd = await this.prisma.user.findFirst({
        where: { telegramUsername: data.username.replace(/^@/, '') },
      });
    }

    if (!userToAdd) {
      throw new NotFoundException(`User with identifier ${data.username} not found`);
    }

    const existingMember = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: userToAdd.id } },
    });

    if (existingMember) {
      throw new ForbiddenException('User is already a member of this project');
    }

    const member = await this.prisma.projectMember.create({
      data: {
        projectId,
        userId: userToAdd.id,
        roleId: data.roleId,
      },
      include: { user: true, role: true },
    });

    // Notify user about project invitation
    try {
      const [project, inviter] = await Promise.all([
        this.prisma.project.findUnique({ where: { id: projectId } }),
        this.prisma.user.findUnique({ where: { id: userId } }),
      ]);

      const inviterName = inviter
        ? inviter.fullName ||
          (inviter.telegramUsername ? `@${inviter.telegramUsername}` : 'Unknown User')
        : 'System';

      await this.notifications.create({
        userId: userToAdd.id,
        type: 'PROJECT_INVITE' as any,
        title: 'Project Invitation',
        message: `${inviterName} invited you to project "${project?.name || 'Unknown'}"`,
        meta: { projectId, invitedBy: userId },
      });
    } catch (error: any) {
      this.logger.error(`Failed to send project invitation notification: ${error.message}`);
    }

    return member;
  }

  public async updateMemberRole(
    projectId: string,
    userId: string,
    memberUserId: string,
    data: UpdateMemberDto,
  ) {
    await this.permissions.checkPermission(projectId, userId, PermissionKey.PROJECT_UPDATE);

    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: memberUserId } },
    });

    if (!member) {
      throw new NotFoundException('Member not found in this project');
    }

    return this.prisma.projectMember.update({
      where: { id: member.id },
      data: { roleId: data.roleId },
      include: { user: true, role: true },
    });
  }

  public async removeMember(projectId: string, userId: string, memberUserId: string) {
    this.logger.log(
      `removeMember: projectId=${projectId}, actor=${userId}, target=${memberUserId}`,
    );
    await this.permissions.checkPermission(projectId, userId, PermissionKey.PROJECT_UPDATE);

    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: memberUserId } },
    });

    if (!member) {
      this.logger.warn(
        `removeMember: Member not found. projectId=${projectId}, memberUserId=${memberUserId}`,
      );
      throw new NotFoundException('Member not found in this project');
    }

    return this.prisma.projectMember.delete({
      where: { id: member.id },
    });
  }

  public async searchNews(projectId: string, userId: string, query: any) {
    await this.permissions.checkProjectAccess(projectId, userId);

    const config = this.configService.get<NewsConfig>('news')!;
    let baseUrl = config.serviceUrl.replace(/\/$/, '');
    
    // Ensure we don't duplicate /api/v1 if it's already in the config
    if (!baseUrl.endsWith('/api/v1')) {
      baseUrl = `${baseUrl}/api/v1`;
    }
    
    const url = `${baseUrl}/data/search`;

    try {
      const searchParams: any = {
        q: query.q,
      };

      if (query.since) searchParams.since = query.since;
      if (query.source) searchParams.source = query.source;
      if (query.limit) searchParams.limit = query.limit;
      if (query.minScore !== undefined) searchParams.minScore = query.minScore;

      const response = await request(url, {
        method: 'GET',
        query: searchParams,
      });

      if (response.statusCode >= 400) {
        const errorText = await response.body.text();
        this.logger.error(`News microservice returned ${response.statusCode}: ${errorText}`);
        throw new Error(`News microservice error: ${response.statusCode}`);
      }

      return response.body.json();
    } catch (error: any) {
      this.logger.error(`Failed to search news: ${error.message}`);
      throw error;
    }
  }
}
// Force rebuild
