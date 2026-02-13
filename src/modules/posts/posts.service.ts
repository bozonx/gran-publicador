import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PostStatus, PostType, PublicationStatus } from '../../generated/prisma/index.js';
import { PermissionsService } from '../../common/services/permissions.service.js';
import { normalizeOverrideContent } from '../../common/validators/social-media-validation.validator.js';

import { ChannelsService } from '../channels/channels.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TagsService } from '../tags/tags.service.js';
import { normalizeTags } from '../../common/utils/tags.util.js';

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly channelsService: ChannelsService,
    private readonly tagsService: TagsService,
  ) {}

  private async refreshPublicationEffectiveAt(publicationId: string) {
    const publication = await this.prisma.publication.findUnique({
      where: { id: publicationId },
      select: { id: true, createdAt: true, scheduledAt: true },
    });

    if (!publication) return;

    const publishedAgg = await this.prisma.post.aggregate({
      where: {
        publicationId,
        status: PostStatus.PUBLISHED,
        publishedAt: { not: null },
      },
      _max: {
        publishedAt: true,
      },
    });

    const effectiveAt =
      publishedAgg._max.publishedAt ?? publication.scheduledAt ?? publication.createdAt;

    await this.prisma.publication.update({
      where: { id: publicationId },
      data: { effectiveAt },
    });
  }

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
  private applyCommonFilters(
    where: any,
    filters?: {
      status?: PostStatus;
      postType?: PostType;
      search?: string;
      publicationStatus?: PublicationStatus;
    },
  ) {
    if (filters?.status && typeof filters.status === 'string') {
      where.status = filters.status.toUpperCase() as PostStatus;
    }
    if (filters?.publicationStatus) {
      const statuses = Array.isArray(filters.publicationStatus)
        ? filters.publicationStatus
        : [filters.publicationStatus];
      where.publication = {
        ...where.publication,
        status: { in: statuses.map(s => s.toUpperCase() as PublicationStatus) },
      };
    }
    if (filters?.postType && typeof filters.postType === 'string') {
      where.publication = {
        ...where.publication,
        postType: filters.postType.toUpperCase() as PostType,
      };
    }
    if (filters?.search) {
      where.publication = {
        ...where.publication,
        OR: [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { content: { contains: filters.search, mode: 'insensitive' } },
        ],
      };
    }
    return where;
  }

  public async create(
    userId: string,
    channelId: string,
    data: {
      publicationId: string; // Now required
      socialMedia?: string;
      tags?: string[];
      status?: PostStatus;
      scheduledAt?: Date;
      content?: string | null;
      meta?: any;
      platformOptions?: any;
      authorSignature?: string;
    },
  ) {
    const channel = await this.channelsService.findOne(channelId, userId);
    await this.permissions.checkProjectPermission(channel.projectId, userId, ['ADMIN', 'EDITOR']);

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

    if (
      publication.status === PublicationStatus.READY ||
      publication.status === PublicationStatus.SCHEDULED
    ) {
      if (data.status !== PostStatus.PENDING) {
        throw new BadRequestException(
          'Publication is read-only in READY/SCHEDULED status. Switch to DRAFT to add new posts.',
        );
      }
    }

    // Validation: Check content limits
    const { validatePostContent } =
      await import('../../common/validators/social-media-validation.validator.js');
    const mediaCount =
      (await this.prisma.publicationMedia.count({
        where: { publicationId: data.publicationId },
      })) || 0;
    const normalizedOverrideContent = normalizeOverrideContent(data.content);

    // Effective content: use specific post content or fallback to publication content
    const effectiveContent = normalizedOverrideContent ?? publication.content;
    const socialMedia = (data.socialMedia ?? channel.socialMedia) as any;

    const validationResult = validatePostContent({
      content: effectiveContent,
      mediaCount: mediaCount,
      socialMedia: socialMedia,
    });

    // If validation fails, set status to FAILED and record error message
    let postStatus = data.status ?? PostStatus.PENDING;
    let errorMessage: string | null = null;

    if (!validationResult.isValid) {
      postStatus = PostStatus.FAILED;
      errorMessage = `Validation failed for ${socialMedia}: ${validationResult.errors.join('; ')}`;
      this.logger.warn(
        `Creating post with FAILED status due to validation errors: ${errorMessage}`,
      );
    }

    // Author Signature - use explicitly provided content or leave empty
    const authorSignature: string | undefined = data.authorSignature || undefined;

    const post = await this.prisma.post.create({
      data: {
        channelId,
        publicationId: data.publicationId,
        socialMedia: data.socialMedia ?? channel.socialMedia,
        status: postStatus,
        scheduledAt: data.scheduledAt,
        content: normalizedOverrideContent ?? null,
        meta: data.meta ?? {},
        platformOptions: data.platformOptions,
        authorSignature: authorSignature || undefined,
        errorMessage,
        tagObjects: (await this.tagsService.prepareTagsConnectOrCreate(
          normalizeTags(data.tags ?? []),
          {
            projectId: channel.projectId,
          },
        )) as any,
      },
      include: {
        channel: true,
        publication: {
          include: {
            tagObjects: true,
          },
        },
        tagObjects: true,
      },
    });

    this.logger.log(
      `Created post ${post.id}. platformOptions: ${JSON.stringify(data.platformOptions)}`,
    );
    return post;
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
    filters?: {
      status?: PostStatus;
      postType?: PostType;
      search?: string;
      includeArchived?: boolean;
      limit?: number;
      page?: number;
    },
  ) {
    // Check project permission (owner/admin/editor/viewer)
    const role = await this.permissions.getUserProjectRole(projectId, userId);
    if (!role) {
      throw new ForbiddenException('You are not a member of this project');
    }

    const where: any = {
      channel: { projectId },
    };

    if (!filters?.includeArchived) {
      where.channel = {
        ...where.channel,
        archivedAt: null,
      };
      where.publication = { archivedAt: null };
    } else {
      where.OR = [
        { channel: { archivedAt: { not: null } } },
        { channel: { project: { archivedAt: { not: null } } } },
        { publication: { archivedAt: { not: null } } },
      ];
    }

    this.applyCommonFilters(where, filters);

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
        publication: {
          include: {
            tagObjects: true,
          },
        },
        tagObjects: true,
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
    filters?: {
      status?: PostStatus;
      postType?: PostType;
      search?: string;
      includeArchived?: boolean;
      limit?: number;
      page?: number;
    },
  ) {
    const where: any = {};

    if (!filters?.includeArchived) {
      where.channel = {
        project: {
          OR: [{ ownerId: userId }, { members: { some: { userId } } }],
          archivedAt: null,
        },
        archivedAt: null,
      };
      where.publication = { archivedAt: null };
    } else {
      where.OR = [
        { channel: { archivedAt: { not: null } } },
        { channel: { project: { archivedAt: { not: null } } } },
        { publication: { archivedAt: { not: null } } },
      ];
      // Still must belong to user's projects
      where.channel = {
        ...where.channel,
        project: {
          OR: [{ ownerId: userId }, { members: { some: { userId } } }],
        },
      };
    }

    this.applyCommonFilters(where, filters);

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
        publication: { include: { tagObjects: true } },
        tagObjects: true,
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
    filters?: {
      status?: PostStatus;
      postType?: PostType;
      search?: string;
      includeArchived?: boolean;
      limit?: number;
      page?: number;
    },
  ) {
    const channel = await this.channelsService.findOne(channelId, userId, true);

    // Ensure user has access to the channel's project
    if (!channel.role) {
      throw new ForbiddenException('You do not have access to this channel');
    }

    const where: any = {
      channelId,
    };

    if (!filters?.includeArchived) {
      where.publication = { archivedAt: null };
    } else {
      where.publication = { archivedAt: { not: null } };
    }

    this.applyCommonFilters(where, filters);

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
        publication: { include: { tagObjects: true } },
        tagObjects: true,
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
        publication: {
          include: {
            tagObjects: true,
          },
        },
        tagObjects: true,
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
      tags?: string[];
      status?: PostStatus;
      scheduledAt?: Date | null;
      publishedAt?: Date | null;
      errorMessage?: string | null;
      content?: string | null;
      meta?: any;
      platformOptions?: any;
      authorSignature?: string | null;
    },
  ) {
    const post = await this.findOne(id, userId);

    const publicationStatus = post.publication?.status;
    if (
      publicationStatus === PublicationStatus.READY ||
      publicationStatus === PublicationStatus.SCHEDULED
    ) {
      const allowedKeys = ['status', 'scheduledAt', 'publishedAt', 'errorMessage'];
      const updatedKeys = Object.keys(data).filter(k => (data as any)[k] !== undefined);
      const invalidKeys = updatedKeys.filter(key => !allowedKeys.includes(key));

      if (invalidKeys.length > 0) {
        throw new BadRequestException(
          `Publication is read-only in ${publicationStatus} status. Cannot modify post fields: ${invalidKeys.join(', ')}. Switch to DRAFT to modify it.`,
        );
      }
    }

    const prevPublishedAt = post.publishedAt;
    const prevStatus = post.status;

    // Permission: Only publication author or admin/owner of the project can update
    if (post.publication?.createdBy !== userId) {
      const channel = await this.prisma.channel.findUnique({ where: { id: post.channelId } });
      if (channel) {
        await this.permissions.checkProjectPermission(channel.projectId, userId, ['ADMIN']);
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
      data.errorMessage = null;
      data.publishedAt = null;
    }

    // Clear error if status is explicitly changed to something else than FAILED
    if (data.status && data.status !== PostStatus.FAILED) {
      data.errorMessage = null;
    }

    // Clear publishedAt if status is changed to PENDING
    if (data.status === PostStatus.PENDING) {
      data.publishedAt = null;
    }

    // Business Rule: When removing scheduledAt from post
    if (data.scheduledAt === null) {
      data.errorMessage = null;
    }

    // Validation: Check content limits if content is being updated or if inheritance might change
    if (data.content !== undefined) {
      const { validatePostContent } =
        await import('../../common/validators/social-media-validation.validator.js');
      const normalizedOverrideContent = normalizeOverrideContent(data.content);

      // Need media count
      const mediaCount =
        (await this.prisma.publicationMedia.count({
          where: { publicationId: post.publicationId },
        })) || 0;

      // Effective content
      // If data.content is null, we inherit from post.publication.content
      // If data.content is string, we use it
      const effectiveContent = normalizedOverrideContent ?? post.publication?.content;

      // Post social media? It is on the channel.
      const channel = await this.prisma.channel.findUnique({ where: { id: post.channelId } });
      if (channel) {
        const validationResult = validatePostContent({
          content: effectiveContent,
          mediaCount: mediaCount,
          socialMedia: channel.socialMedia as any,
        });

        // If validation fails, set status to FAILED and record error message
        if (!validationResult.isValid) {
          data.status = PostStatus.FAILED;
          data.errorMessage = `Validation failed for ${channel.socialMedia}: ${validationResult.errors.join('; ')}`;
          this.logger.warn(
            `Updating post ${id} with FAILED status due to validation errors: ${data.errorMessage}`,
          );
        }
      }

      data.content = normalizedOverrideContent ?? null;
    }

    this.logger.log(
      `Updating post ${id}. platformOptions: ${JSON.stringify(data.platformOptions)}`,
    );

    const updatedPost = await this.prisma.post.update({
      where: { id },
      data: {
        status: data.status,
        scheduledAt: data.scheduledAt,
        publishedAt: data.publishedAt,
        errorMessage: data.errorMessage,
        content: data.content,
        meta: data.meta,
        platformOptions: data.platformOptions,
        authorSignature: data.authorSignature,
        tagObjects:
          data.tags !== undefined
            ? ((await this.tagsService.prepareTagsConnectOrCreate(
                normalizeTags(data.tags),
                {
                  projectId: post.channel?.projectId || '',
                },
                true,
              )) as any)
            : undefined,
      },
      include: {
        channel: true,
        publication: true,
      },
    });

    const shouldRefreshPublicationEffectiveAt =
      data.publishedAt !== undefined ||
      data.status !== undefined ||
      prevPublishedAt !== updatedPost.publishedAt ||
      prevStatus !== updatedPost.status;

    if (shouldRefreshPublicationEffectiveAt) {
      await this.refreshPublicationEffectiveAt(updatedPost.publicationId);
    }

    this.logger.log(
      `Updated post ${id}. platformOptions in return: ${JSON.stringify(updatedPost.platformOptions)}`,
    );
    return updatedPost;
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

    const publicationStatus = post.publication?.status;
    if (
      publicationStatus === PublicationStatus.READY ||
      publicationStatus === PublicationStatus.SCHEDULED
    ) {
      throw new BadRequestException(
        'Publication is read-only in READY/SCHEDULED status. Switch to DRAFT to modify posts.',
      );
    }

    // Permission: Only publication author or admin/owner of the project can delete
    if (post.publication?.createdBy !== userId) {
      const channel = await this.prisma.channel.findUnique({ where: { id: post.channelId } });
      if (channel) {
        await this.permissions.checkProjectPermission(channel.projectId, userId, ['ADMIN']);
      } else {
        throw new ForbiddenException('Insufficient permissions');
      }
    }

    return this.prisma.post.delete({
      where: { id },
    });
  }
}
