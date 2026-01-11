import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ProjectRole,
  Prisma,
  type Project,
  PublicationStatus,
  PostStatus,
} from '../../generated/prisma/client.js';

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
  ) {}

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

        await tx.projectMember.create({
          data: {
            projectId: project.id,
            userId: userId,
            role: ProjectRole.OWNER,
          },
        });

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
      members: { some: { userId } },
      ...(includeArchived !== undefined
        ? { archivedAt: includeArchived ? { not: null } : null }
        : { archivedAt: null }),
    };

    if (search) {
      where.OR = [{ name: { contains: search } }, { description: { contains: search } }];
    }

    const projects = await this.prisma.project.findMany({
      where,
      include: {
        _count: { select: { members: true, channels: true, publications: true } },
        members: { where: { userId }, select: { role: true } },
        publications: {
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
          status: { in: [PublicationStatus.FAILED, PublicationStatus.PARTIAL] },
          archivedAt: null,
        },
        _count: { id: true },
      }),
      this.prisma.post.groupBy({
        by: ['channelId'],
        where: { status: PostStatus.FAILED, channel: { projectId: { in: projectIds } } },
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
      this.prisma.channel.groupBy({
        by: ['projectId'],
        where: {
          projectId: { in: projectIds },
          archivedAt: null,
          OR: [{ credentials: { equals: {} } }, { credentials: { equals: Prisma.AnyNull } }],
        },
        _count: { id: true },
      }),
      this.prisma.channel.groupBy({
        by: ['projectId'],
        where: { projectId: { in: projectIds }, archivedAt: null, isActive: false },
        _count: { id: true },
      }),
      this.prisma.channel.findMany({
        where: { projectId: { in: projectIds }, archivedAt: null },
        select: { projectId: true, language: true },
        distinct: ['projectId', 'language'],
      }),
    ]);

    const problematicCountMap = Object.fromEntries(
      problematicCounts.map(c => [c.projectId, c._count.id]),
    );
    const failedPostsMap = new Map<string, number>();
    failedPostsRaw.forEach((row: any) => failedPostsMap.set(row.projectId, Number(row.count || 0)));
    const staleChannelsMap = new Map<string, number>();
    staleChannelsRaw.forEach((row: any) =>
      staleChannelsMap.set(row.projectId, Number(row.count || 0)),
    );
    const noCredentialsMap = new Map<string, number>();
    noCredentialsRaw.forEach((row: any) =>
      noCredentialsMap.set(row.projectId, Number(row.count || 0)),
    );
    const inactiveMap = new Map<string, number>();
    inactiveRaw.forEach((row: any) => inactiveMap.set(row.projectId, Number(row.count || 0)));
    const languageMap = new Map<string, string[]>();
    projectLanguages.forEach(l => {
      if (!languageMap.has(l.projectId)) languageMap.set(l.projectId, []);
      languageMap.get(l.projectId)?.push(l.language);
    });

    return projects.map(project => {
      const userMember = project.members[0];
      const lastPublicationAt = project.publications[0]?.createdAt || null;
      const lastPublicationId = project.publications[0]?.id || null;

      return {
        ...project,
        channels: [],
        role: userMember?.role?.toLowerCase(),
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
      where: { archivedAt: { not: null }, members: { some: { userId } } },
      include: {
        members: { where: { userId }, select: { role: true } },
        _count: { select: { channels: true, publications: true } },
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
            _count: { select: { posts: true } },
            posts: {
              where: { status: PostStatus.PUBLISHED },
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
        role: project.members[0]?.role?.toLowerCase(),
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
    const role = await this.permissions.getUserProjectRole(projectId, userId);
    if (!role) throw new ForbiddenException('You are not a member of this project');

    const project = await this.prisma.project.findUnique({
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

    const projectPrefs = (project.preferences as any) || {};
    let staleChannelsCount = 0;
    const channelIds = project.channels.map(c => c.id);
    const failedPostCounts =
      channelIds.length > 0
        ? await this.prisma.post.groupBy({
            by: ['channelId'],
            where: { channelId: { in: channelIds }, status: PostStatus.FAILED },
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

    const [problemCount, noCredsCount, inactiveCount] = await Promise.all([
      this.prisma.publication.count({
        where: {
          projectId,
          status: { in: [PublicationStatus.FAILED, PublicationStatus.PARTIAL] },
          archivedAt: null,
        },
      }),
      this.prisma.channel.count({
        where: {
          projectId,
          archivedAt: null,
          OR: [{ credentials: { equals: {} } }, { credentials: { equals: Prisma.AnyNull } }],
        },
      }),
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
      noCredentialsChannelsCount: noCredsCount,
      inactiveChannelsCount: inactiveCount,
    };
  }

  public async update(projectId: string, userId: string, data: UpdateProjectDto) {
    await this.permissions.checkProjectPermission(projectId, userId, [
      ProjectRole.OWNER,
      ProjectRole.ADMIN,
    ]);
    return this.prisma.project.update({
      where: { id: projectId },
      data: { ...data, preferences: data.preferences ? (data.preferences as any) : undefined },
    });
  }

  public async remove(projectId: string, userId: string) {
    await this.permissions.checkProjectPermission(projectId, userId, [
      ProjectRole.OWNER,
      ProjectRole.ADMIN,
    ]);
    return this.prisma.project.delete({ where: { id: projectId } });
  }

  public async archive(projectId: string, userId: string) {
    await this.permissions.checkProjectPermission(projectId, userId, [
      ProjectRole.OWNER,
      ProjectRole.ADMIN,
    ]);
    return this.prisma.project.update({
      where: { id: projectId },
      data: { archivedAt: new Date(), archivedBy: userId },
    });
  }

  public async unarchive(projectId: string, userId: string) {
    await this.permissions.checkProjectPermission(projectId, userId, [
      ProjectRole.OWNER,
      ProjectRole.ADMIN,
    ]);
    return this.prisma.project.update({
      where: { id: projectId },
      data: { archivedAt: null, archivedBy: null },
    });
  }
}
