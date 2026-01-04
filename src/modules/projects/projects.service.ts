import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ProjectRole, type Project } from '../../generated/prisma/client.js';

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
  public async findAllForUser(
    userId: string,
    options?: { includeArchived?: boolean },
  ) {
    const includeArchived = options?.includeArchived ?? false;

    const projects = await this.prisma.project.findMany({
      where: {
        ...(includeArchived ? {} : { archivedAt: null }),
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
      orderBy: { createdAt: 'desc' },
    });

    return projects.map(project => {
      const userMember = project.members[0]; // We filtered by userId, so there is at most one

      const lastPublicationAt = project.publications[0]?.createdAt || null;
      const lastPublicationId = project.publications[0]?.id || null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const failedPostsCount = (project.channels as any[] || []).reduce((acc, ch) => acc + (ch._count?.posts || 0), 0);
      const languages = [...new Set((project.channels || []).map(c => c.language))].sort();

      const projectPreferences = project.preferences ? JSON.parse(project.preferences) : {};
      let staleChannelsCount = 0;

      const channels = (project.channels || []).map(c => {
        const channelPreferences = c.preferences ? JSON.parse(c.preferences) : {};
        // @ts-ignore
        const lastPostAt = c.posts[0]?.publishedAt || null; 
        
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const failedPostsCount = (project.channels as any[] || []).reduce((acc, ch) => acc + (ch._count?.posts || 0), 0);
      const languages = [...new Set((project.channels || []).map(c => c.language))].sort();
      
      const projectPreferences = project.preferences ? JSON.parse(project.preferences) : {};
      let staleChannelsCount = 0;

      const channels = (project.channels || []).map(c => {
         const channelPreferences = c.preferences ? JSON.parse(c.preferences) : {};
         // @ts-ignore
         const lastPostAt = c.posts[0]?.publishedAt || null;
         
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
            publications: { where: { archivedAt: null } },
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
              select: { posts: { where: publishedPostFilter } },
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

    const mappedChannels = project.channels.map(channel => {
      const channelPreferences = channel.preferences ? JSON.parse(channel.preferences) : {};
      const lastPostAt = channel.posts[0]?.publishedAt || channel.posts[0]?.createdAt || null;
      
      // Calculate isStale based on publishedAt if available, otherwise createdAt? 
      // Requirement says "publications with status published". So I should probably look for publishedAt.
      // But findOne includes posts with status PUBLISHED.
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

      return {
        ...channel,
        postsCount: channel._count.posts,
        lastPostAt: lastPostAt,
        isStale,
        preferences: channelPreferences,
      };
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
