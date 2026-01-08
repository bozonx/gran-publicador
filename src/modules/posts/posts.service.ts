import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PostStatus, PostType, ProjectRole } from '../../generated/prisma/client.js';

import { PermissionsService } from '../../common/services/permissions.service.js';
import { ChannelsService } from '../channels/channels.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class PostsService {
  constructor(
    private prisma: PrismaService,
    private channelsService: ChannelsService,
    private permissions: PermissionsService,
  ) { }

  /**
   * Create a new post in a specific channel.
   * Requires OWNER, ADMIN, or EDITOR role in the channel's project.
   * All content comes from the parent Publication.
   *
   * @param userId - The ID of the user creating the post.
   * @param channelId - The ID of the target channel.
   * @param data - The post creation data (channel-specific only).
   * @returns The created post.
   */
  public async create(
    userId: string,
    channelId: string,
    data: {
      publicationId: string; // Now required
      socialMedia?: string;
      tags?: string;
      status?: PostStatus;
      scheduledAt?: Date;
      content?: string | null;
    },
  ) {
    const channel = await this.channelsService.findOne(channelId, userId);
    await this.permissions.checkProjectPermission(channel.projectId, userId, [
      ProjectRole.OWNER,
      ProjectRole.ADMIN,
      ProjectRole.EDITOR,
    ]);

    // Verify publication exists and belongs to same project
    const publication = await this.prisma.publication.findFirst({
      where: {
        id: data.publicationId,
        projectId: channel.projectId,
      },
    });

    if (!publication) {
      throw new NotFoundException('Publication not found or does not belong to this project');
    }

    return this.prisma.post.create({
      data: {
        channelId,
        publicationId: data.publicationId,
        socialMedia: data.socialMedia ?? channel.socialMedia,
        tags: data.tags,
        status: data.status ?? PostStatus.PENDING,
        scheduledAt: data.scheduledAt,
        content: data.content,
      },
      include: {
        channel: true,
        publication: true,
      },
    });
  }

  /**
   * Retrieve all posts for a specific project.
   * Validates that the user has access to the project.
   *
   * @param projectId - The ID of the project.
   * @param userId - The ID of the user.
   * @returns A list of posts for all channels in the project.
   */
  public async findAllForProject(
    projectId: string,
    userId: string,
    filters?: { status?: PostStatus; postType?: PostType; search?: string; includeArchived?: boolean; limit?: number; page?: number },
  ) {
    // Check project permission (owner/admin/editor/viewer)
    const role = await this.permissions.getUserProjectRole(projectId, userId);
    if (!role) {
      throw new ForbiddenException('You are not a member of this project');
    }

    const where: any = {
      channel: {
        projectId,
        ...(filters?.includeArchived ? {} : { archivedAt: null }),
        project: { archivedAt: null },
      },
      ...(filters?.includeArchived ? {} : { publication: { archivedAt: null } }),
    };

    if (filters?.status && typeof filters.status === 'string') {
      where.status = filters.status.toUpperCase() as PostStatus;
    }
    if (filters?.postType && typeof filters.postType === 'string') {
      where.publication = {
        ...where.publication,
        postType: filters.postType.toUpperCase() as PostType,
      };
    }
    if (filters?.search) {
      // Search in publication content instead of post
      where.publication = {
        ...where.publication,
        OR: [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { content: { contains: filters.search, mode: 'insensitive' } },
        ],
      };
    }

    return this.prisma.post.findMany({
      where,
      include: {
        channel: {
          select: {
            id: true,
            name: true,
            projectId: true,
            socialMedia: true,
          },
        },
        publication: true, // Include full publication with content
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit,
      skip: filters?.limit && filters?.page ? (filters.page - 1) * filters.limit : undefined,
    });
  }

  /**
   * Retrieve all posts for a given user across all projects they are members of.
   *
   * @param userId - The ID of the user requesting the posts.
   * @param filters - Optional filters (status, search, includeArchived).
   * @returns A list of posts with channel and author info.
   */
  public async findAllForUser(
    userId: string,
    filters?: { status?: PostStatus; postType?: PostType; search?: string; includeArchived?: boolean; limit?: number; page?: number },
  ) {
    const where: any = {
      channel: {
        project: {
          members: {
            some: { userId },
          },
          archivedAt: null,
        },
        ...(filters?.includeArchived ? {} : { archivedAt: null }),
      },
      ...(filters?.includeArchived ? {} : { publication: { archivedAt: null } }),
    };

    if (filters?.status && typeof filters.status === 'string') {
      where.status = filters.status.toUpperCase() as PostStatus;
    }
    if (filters?.postType && typeof filters.postType === 'string') {
      where.publication = {
        ...where.publication,
        postType: filters.postType.toUpperCase() as PostType,
      };
    }
    if (filters?.search) {
      // Search in publication content
      where.publication = {
        ...where.publication,
        OR: [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { content: { contains: filters.search, mode: 'insensitive' } },
        ],
      };
    }

    return this.prisma.post.findMany({
      where,
      include: {
        channel: {
          select: {
            id: true,
            name: true,
            projectId: true,
            socialMedia: true,
          },
        },
        publication: true, // Include full publication
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit,
      skip: filters?.limit && filters?.page ? (filters.page - 1) * filters.limit : undefined,
    });
  }

  /**
   * Retrieve all posts for a specific channel.
   * Validates that the user has access to the channel.
   *
   * @param channelId - The ID of the channel.
   * @param userId - The ID of the user.
   * @returns A list of posts, ordered by creation date (descending).
   */
  public async findAllForChannel(
    channelId: string,
    userId: string,
    filters?: { status?: PostStatus; postType?: PostType; search?: string, includeArchived?: boolean; limit?: number; page?: number },
  ) {

    const channel = await this.channelsService.findOne(channelId, userId, true);
    
    // Ensure user has access to the channel's project
    if (!channel.role) {
      throw new ForbiddenException('You do not have access to this channel');
    }

    const where: any = {
      channelId,
      ...(filters?.includeArchived ? {} : { publication: { archivedAt: null } }),
    };

    if (filters?.status && typeof filters.status === 'string') {
      where.status = filters.status.toUpperCase() as PostStatus;
    }
    if (filters?.postType && typeof filters.postType === 'string') {
      where.publication = {
        ...where.publication,
        postType: filters.postType.toUpperCase() as PostType,
      };
    }
    if (filters?.search) {
      // Search in publication content
      where.publication = {
        ...where.publication,
        OR: [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { content: { contains: filters.search, mode: 'insensitive' } },
        ],
      };
    }

    return this.prisma.post.findMany({
      where,
      include: {
        channel: {
          select: {
            id: true,
            name: true,
            projectId: true,
            socialMedia: true,
          },
        },
        publication: true, // Include full publication
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit,
      skip: filters?.limit && filters?.page ? (filters.page - 1) * filters.limit : undefined,
    });
  }

  /**
   * Find a single post by ID.
   * Ensures the user has access to the channel containing the post.
   *
   * @param id - The ID of the post.
   * @param userId - The ID of the user.
   * @returns The post details.
   * @throws NotFoundException if the post does not exist.
   */
  public async findOne(id: string, userId: string) {
    const post = await this.prisma.post.findUnique({
      where: {
        id,
        channel: {
          archivedAt: null,
          project: { archivedAt: null },
        },
        publication: {
          archivedAt: null,
        },
      },
      include: {
        channel: {
          select: {
            id: true,
            name: true,
            projectId: true,
            socialMedia: true,
          },
        },
        publication: true, // Include full publication with all content
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    await this.channelsService.findOne(post.channelId, userId); // Validates access
    return post;
  }

  /**
   * Update an existing post.
   * Only channel-specific fields can be updated (tags, status, scheduledAt, publishedAt).
   * Content fields are part of Publication and must be updated there.
   * Allowed for the publication author or project OWNER/ADMIN.
   *
   * @param id - The ID of the post.
   * @param userId - The ID of the user.
   * @param data - The data to update (channel-specific fields only).
   * @throws ForbiddenException if the user lacks permissions.
   */
  public async update(
    id: string,
    userId: string,
    data: {
      tags?: string;
      status?: PostStatus;
      scheduledAt?: Date;
      publishedAt?: Date;
      errorMessage?: string;
      content?: string | null;
    },
  ) {
    const post = await this.findOne(id, userId);

    // Permission: Only publication author or admin/owner of the project can update
    if (post.publication?.createdBy !== userId) {
      const channel = await this.prisma.channel.findUnique({ where: { id: post.channelId } });
      if (channel) {
        await this.permissions.checkProjectPermission(channel.projectId, userId, [
          ProjectRole.OWNER,
          ProjectRole.ADMIN,
        ]);
      } else {
        throw new ForbiddenException('Insufficient permissions');
      }
    }

    // Business Rule: When setting scheduledAt for post
    if (data.scheduledAt !== undefined && data.scheduledAt !== null) {
      const publication = await this.prisma.publication.findUnique({
        where: { id: post.publicationId },
        select: { scheduledAt: true },
      });

      if (!publication?.scheduledAt) {
        throw new BadRequestException(
          'Cannot set scheduledAt for post when publication has no scheduledAt',
        );
      }

      data.status = PostStatus.PENDING;
      data.errorMessage = undefined;
    }

    // Business Rule: When removing scheduledAt from post
    if (data.scheduledAt === null) {
      data.errorMessage = undefined;
    }

    return this.prisma.post.update({
      where: { id },
      data: {
        tags: data.tags,
        status: data.status,
        scheduledAt: data.scheduledAt,
        publishedAt: data.publishedAt,
        errorMessage: data.errorMessage,
        content: data.content,
      },
      include: {
        channel: true,
        publication: true,
      },
    });
  }

  /**
   * Remove a post.
   * Allowed for the publication author or project OWNER/ADMIN.
   *
   * @param id - The ID of the post to remove.
   * @param userId - The ID of the user.
   */
  public async remove(id: string, userId: string) {
    const post = await this.findOne(id, userId);

    // Permission: Only publication author or admin/owner of the project can delete
    if (post.publication?.createdBy !== userId) {
      const channel = await this.prisma.channel.findUnique({ where: { id: post.channelId } });
      if (channel) {
        await this.permissions.checkProjectPermission(channel.projectId, userId, [
          ProjectRole.OWNER,
          ProjectRole.ADMIN,
        ]);
      } else {
        throw new ForbiddenException('Insufficient permissions');
      }
    }

    return this.prisma.post.delete({
      where: { id },
    });
  }
}
