import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import {
  PublicationStatus,
  PostStatus,
  PostType,
  Prisma,
  ProjectRole,
  SocialMedia,
} from '../../generated/prisma/client.js';
import { randomUUID } from 'node:crypto';

import { PermissionsService } from '../../common/services/permissions.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PublicationQueryBuilder } from './utils/publication-query.builder.js';
import {
  CreatePublicationDto,
  UpdatePublicationDto,
  IssueType,
  OwnershipType,
} from './dto/index.js';
import { PublicationMediaInputDto } from './dto/publication-media-input.dto.js';

@Injectable()
export class PublicationsService {
  private readonly logger = new Logger(PublicationsService.name);

  constructor(
    private prisma: PrismaService,
    private permissions: PermissionsService,
  ) {}

  private readonly PUBLICATION_WITH_RELATIONS_INCLUDE = {
    creator: {
      select: {
        id: true,
        fullName: true,
        telegramUsername: true,
        avatarUrl: true,
      },
    },
    project: true,
    posts: {
      include: {
        channel: {
          include: {
            project: {
              select: {
                id: true,
                archivedAt: true,
              },
            },
          },
        },
      },
    },
    media: {
      include: {
        media: true,
      },
      orderBy: {
        order: 'asc' as const,
      },
    },
  };

  /**
   * Return meta object, ensuring it's an object.
   */
  private parseMetaJson(meta: any): Record<string, any> {
    return typeof meta === 'object' && meta !== null ? meta : {};
  }

  /**
   * Return sourceTexts array, ensuring it's an array.
   */
  private parseSourceTextsJson(sourceTexts: any): any[] {
    return Array.isArray(sourceTexts) ? sourceTexts : [];
  }

  /**
   * Prepare Prisma orderBy clauses.
   */
  private prepareOrderBy(sortField?: string, sortDirection?: 'asc' | 'desc') {
    return PublicationQueryBuilder.getOrderBy(sortField || 'chronology', sortDirection || 'desc');
  }

  /**
   * Helper to normalize media input from string or object.
   */
  private getMediaInput(item: string | PublicationMediaInputDto): {
    id: string;
    hasSpoiler: boolean;
  } {
    if (typeof item === 'string') {
      return { id: item, hasSpoiler: false };
    }
    return { id: item.id, hasSpoiler: !!item.hasSpoiler };
  }

  /**
   * Create a new publication.
   * If userId is provided, it checks if the user has access to the project.
   * If userId is not provided, it assumes a system call or external integration (skipped permission check).
   *
   * @param data - The publication creation data.
   * @param userId - Optional ID of the user creating the publication.
   * @returns The created publication.
   */
  public async create(data: CreatePublicationDto, userId?: string) {
    if (userId && data.projectId) {
      // Check if user has access to the project
      await this.permissions.checkProjectAccess(data.projectId, userId);
    }

    // Validation for personal drafts (no project)
    if (!data.projectId) {
      if (
        data.status &&
        data.status !== PublicationStatus.DRAFT &&
        data.status !== PublicationStatus.READY
      ) {
        throw new BadRequestException('Personal drafts can only have DRAFT or READY status');
      }

      if (data.scheduledAt) {
        throw new BadRequestException('Personal drafts cannot be scheduled');
      }

      if (data.channelIds?.length) {
        throw new BadRequestException('Cannot create posts for personal drafts');
      }
    }

    let translationGroupId = data.translationGroupId;

    // Handle linking to an existing publication
    if (data.linkToPublicationId) {
      // 1. Fetch target publication
      const targetPub = await this.prisma.publication.findUnique({
        where: { id: data.linkToPublicationId },
      });

      if (!targetPub) {
        throw new NotFoundException(`Target publication for linking not found`);
      }

      // 2. Validate Access (if user context provided)
      if (userId && targetPub.projectId) {
        await this.permissions.checkProjectAccess(targetPub.projectId, userId);
      } else if (userId && targetPub.createdBy !== userId) {
        throw new ForbiddenException('Access denied to personal draft');
      }

      // 3. Validate Project Scope (Issue 2)
      if (targetPub.projectId !== data.projectId) {
        throw new BadRequestException(
          'Cannot link publications from different projects or contexts',
        );
      }

      // 4. Validate Post Type Compatibility (User Request)
      if (data.postType && targetPub.postType !== data.postType) {
        throw new BadRequestException(
          `Cannot link publication of type ${data.postType} with ${targetPub.postType}`,
        );
      }

      // Determine Group ID
      if (targetPub.translationGroupId) {
        translationGroupId = targetPub.translationGroupId;
      } else {
        // Create new group and assign to target
        translationGroupId = randomUUID();
        await this.prisma.publication.update({
          where: { id: targetPub.id },
          data: { translationGroupId },
        });
        this.logger.log(
          `Created new translation group ${translationGroupId} for publication ${targetPub.id}`,
        );
      }
    }

    // 5. Validate Language Uniqueness in Group (Issue 1)
    if (translationGroupId) {
      const existingTranslation = await this.prisma.publication.findFirst({
        where: {
          translationGroupId,
          language: data.language,
          // No need to exclude current ID as we are creating
        },
      });

      if (existingTranslation) {
        throw new BadRequestException(
          `A publication with language ${data.language} already exists in this translation group`,
        );
      }
    }

    const publication = await this.prisma.publication.create({
      data: {
        projectId: data.projectId ?? null,
        createdBy: userId ?? null,
        title: data.title,
        description: data.description,
        content: data.content,
        authorComment: data.authorComment,

        media: {
          create: [
            // New Media
            ...(data.media || []).map((m, i) => ({
              order: i,
              media: { create: { ...m, meta: (m.meta || {}) as any } },
            })),
            // Existing Media
            ...(data.existingMediaIds || []).map((item, i) => {
              const input = this.getMediaInput(item);
              return {
                order: (data.media?.length || 0) + i,
                mediaId: input.id,
                hasSpoiler: input.hasSpoiler,
              };
            }),
          ],
        },

        tags: data.tags,
        status: data.status ?? PublicationStatus.DRAFT,
        language: data.language,
        translationGroupId,
        postType: data.postType ?? PostType.POST,
        postDate: data.postDate,
        scheduledAt: data.scheduledAt,
        meta: (data.meta ?? {}) as any,
        sourceTexts: (data.sourceTexts ?? []) as any,
      },
      include: this.PUBLICATION_WITH_RELATIONS_INCLUDE,
    });

    const author = userId ? `user ${userId}` : 'external system';
    const projectInfo = data.projectId ? `project ${data.projectId}` : 'personal drafts';
    this.logger.log(
      `Publication "${publication.title ?? publication.id}" created in ${projectInfo} by ${author}`,
    );

    // Automatically create posts for specified channels
    if (data.channelIds && data.channelIds.length > 0) {
      await this.createPostsFromPublication(
        publication.id,
        data.channelIds,
        userId,
        undefined, // no scheduled time by default
      );
      this.logger.log(`Created ${data.channelIds.length} posts for publication ${publication.id}`);
    }

    return {
      ...publication,
      meta: this.parseMetaJson(publication.meta),
      sourceTexts: this.parseSourceTextsJson(publication.sourceTexts),
    };
  }

  /**
   * Retrieve all publications for a project, optionally filtered.
   * Validates that the user has access to the project.
   *
   * @param projectId - The ID of the project.
   * @param userId - The ID of the user.
   * @param filters - Optional filters (status, limit, offset, sorting, search, etc.).
   * @returns Publications with total count for pagination.
   */
  public async findAll(
    projectId: string,
    userId: string,
    filters?: {
      status?: PublicationStatus | PublicationStatus[];
      limit?: number;
      offset?: number;
      includeArchived?: boolean;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      channelId?: string;
      search?: string;
      language?: string;
      ownership?: OwnershipType;
      socialMedia?: SocialMedia;
      issueType?: IssueType;
      publishedAfter?: Date;
    },
  ) {
    await this.permissions.checkProjectAccess(projectId, userId);

    const where = PublicationQueryBuilder.buildWhere(userId, projectId, filters);
    const orderBy = this.prepareOrderBy(filters?.sortBy, filters?.sortOrder);

    const [items, total] = await Promise.all([
      this.prisma.publication.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              fullName: true,
              telegramUsername: true,
              avatarUrl: true,
            },
          },
          posts: {
            include: {
              channel: true,
            },
          },
          media: {
            include: {
              media: true,
            },
            orderBy: {
              order: 'asc',
            },
          },
          _count: {
            select: {
              posts: true,
            },
          },
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy,
        take: filters?.limit,
        skip: filters?.offset,
      }),
      this.prisma.publication.count({ where }),
    ]);

    return {
      items: items.map((item: any) => ({
        ...item,
        meta: this.parseMetaJson(item.meta),
        sourceTexts: this.parseSourceTextsJson(item.sourceTexts),
      })),
      total,
    };
  }

  /**
   * Retrieve all personal drafts for a user.
   *
   * @param userId - The ID of the user.
   * @param filters - Optional filters.
   * @returns Publications with total count for pagination.
   */
  public async findUserDrafts(
    userId: string,
    filters?: {
      status?: PublicationStatus | PublicationStatus[];
      limit?: number;
      offset?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      search?: string;
    },
  ) {
    const where: Prisma.PublicationWhereInput = {
      projectId: null as any,
      createdBy: userId,
      archivedAt: null,
    };

    if (filters?.status) {
      where.status = Array.isArray(filters.status) ? { in: filters.status } : filters.status;
    }

    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search } },
        { content: { contains: filters.search } },
      ];
    }

    const orderBy = this.prepareOrderBy(filters?.sortBy, filters?.sortOrder);

    const [items, total] = await Promise.all([
      this.prisma.publication.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
            },
          },
          media: {
            include: {
              media: true,
            },
            orderBy: {
              order: 'asc',
            },
          },
          _count: {
            select: {
              posts: true,
            },
          },
        },
        orderBy,
        take: filters?.limit,
        skip: filters?.offset,
      }),
      this.prisma.publication.count({ where }),
    ]);

    return {
      items: items.map((item: any) => ({
        ...item,
        meta: this.parseMetaJson(item.meta),
        sourceTexts: this.parseSourceTextsJson(item.sourceTexts),
      })),
      total,
    };
  }

  /**
   * Retrieve all publications for a given user across all projects they are members of.
   *
   * @param userId - The ID of the user requesting the publications.
   * @param filters - Optional filters (status, limit, offset, includeArchived, sorting, search, etc.).
   * @returns Publications with total count for pagination.
   */
  /**
   * Retrieve all publications for a given user across all projects they are members of.
   *
   * @param userId - The ID of the user requesting the publications.
   * @param filters - Optional filters.
   * @returns Publications with total count for pagination.
   */
  public async findAllForUser(
    userId: string,
    filters?: {
      status?: PublicationStatus | PublicationStatus[];
      limit?: number;
      offset?: number;
      includeArchived?: boolean;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      channelId?: string;
      search?: string;
      language?: string;
      ownership?: OwnershipType;
      socialMedia?: SocialMedia;
      issueType?: IssueType;
      publishedAfter?: Date;
    },
  ) {
    this.logger.log(
      `findAllForUser called for user ${userId} with search: "${filters?.search || ''}"`,
    );
    // 1. Get all projects where user is a member or owner
    const userProjects = await this.prisma.project.findMany({
      where: {
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      select: { id: true },
    });
    const userProjectIds = userProjects.map(p => p.id);

    if (userProjectIds.length === 0) {
      return { items: [], total: 0 };
    }

    const where = PublicationQueryBuilder.buildWhere(userId, undefined, filters, userProjectIds);
    const orderBy = this.prepareOrderBy(filters?.sortBy, filters?.sortOrder);

    const [items, total] = await Promise.all([
      this.prisma.publication.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              fullName: true,
              telegramUsername: true,
              avatarUrl: true,
            },
          },
          posts: {
            include: {
              channel: true,
            },
          },
          media: {
            include: {
              media: true,
            },
            orderBy: {
              order: 'asc',
            },
          },
          _count: {
            select: {
              posts: true,
            },
          },
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy,
        take: filters?.limit,
        skip: filters?.offset,
      }),
      this.prisma.publication.count({ where }),
    ]);

    return {
      items: items.map((item: any) => ({
        ...item,
        meta: this.parseMetaJson(item.meta),
        sourceTexts: this.parseSourceTextsJson(item.sourceTexts),
      })),
      total,
    };
  }

  /**
   * Find a single publication by ID.
   * Ensures the user has access to the project containing the publication.
   *
   * @param id - The ID of the publication.
   * @param userId - The ID of the user.
   * @returns The publication details.
   * @throws NotFoundException if the publication does not exist.
   */
  public async findOne(id: string, userId: string) {
    const publication = await this.prisma.publication.findUnique({
      where: {
        id,
      },
      include: this.PUBLICATION_WITH_RELATIONS_INCLUDE,
    });

    if (!publication) {
      throw new NotFoundException('Publication not found');
    }

    if (publication.projectId) {
      await this.permissions.checkProjectAccess(publication.projectId, userId);
    } else {
      // For personal drafts, only creator can see it
      if (publication.createdBy !== userId) {
        throw new NotFoundException('Publication not found'); // Use 404 to avoid leaking existence
      }
    }

    // Fetch other publications in the same translation group
    let translations: any[] = [];
    if (publication.translationGroupId) {
      translations = await this.prisma.publication.findMany({
        where: {
          translationGroupId: publication.translationGroupId,
          id: { not: id },
          archivedAt: null,
        },
        select: {
          id: true,
          language: true,
          postType: true,
          title: true,
        },
        orderBy: {
          language: 'asc',
        },
      });
    }

    // Parse meta JSON for media items
    const parsedMedia = publication.media?.map(pm => {
      if (!pm.media) return pm;
      return {
        ...pm,
        media: {
          ...pm.media,
          meta: this.parseMetaJson(pm.media.meta),
        },
      };
    });

    return {
      ...publication,
      media: parsedMedia,
      translations,
      meta: this.parseMetaJson(publication.meta),
      sourceTexts: this.parseSourceTextsJson((publication as any).sourceTexts),
    };
  }

  /**
   * Update an existing publication.
   * Allowed for the author or project OWNER/ADMIN.
   *
   * @param id - The ID of the publication.
   * @param userId - The ID of the user.
   * @param data - The data to update.
   */
  public async update(id: string, userId: string, data: UpdatePublicationDto) {
    const publication = await this.findOne(id, userId);

    // Check if user is author or has admin rights
    if (publication.createdBy !== userId) {
      if (!publication.projectId) {
        throw new NotFoundException('Publication not found');
      }
      await this.permissions.checkProjectPermission(publication.projectId, userId, [
        ProjectRole.ADMIN,
      ]);
    }

    // Permission check for moving to another project
    if (data.projectId !== undefined && data.projectId !== publication.projectId) {
      if (data.projectId) {
        await this.permissions.checkProjectAccess(data.projectId, userId);
      }
    }

    // Additional validations for personal drafts
    if (!publication.projectId) {
      if (
        data.status &&
        data.status !== PublicationStatus.DRAFT &&
        data.status !== PublicationStatus.READY
      ) {
        throw new BadRequestException('Personal drafts can only have DRAFT or READY status');
      }

      if (data.scheduledAt) {
        throw new BadRequestException('Personal drafts cannot be scheduled');
      }
    }

    let translationGroupId = data.translationGroupId;

    // Handle Unlinking: if explicit null is passed, we accept it.
    // If undefined, we keep current (handled by 'const translationGroupId = data.translationGroupId' -> undefined)
    // BUT we must check if user wants to change logic.
    // Prisma update: undefined means "do nothing", null means "set to NULL".

    if (data.linkToPublicationId) {
      // 1. Self-linking check (Issue 9)
      if (data.linkToPublicationId === id) {
        throw new BadRequestException('Cannot link publication to itself');
      }

      // 2. Fetch target
      const targetPub = await this.prisma.publication.findUnique({
        where: { id: data.linkToPublicationId },
      });

      if (!targetPub) {
        throw new NotFoundException(`Target publication for linking not found`);
      }

      // 3. Access Check
      if (publication.createdBy !== userId) {
        if (targetPub.projectId) {
          await this.permissions.checkProjectAccess(targetPub.projectId, userId);
        } else if (targetPub.createdBy !== userId) {
          throw new ForbiddenException('Access denied to personal draft');
        }
      }

      // 4. Project Scope
      if (targetPub.projectId !== publication.projectId) {
        // Assuming project doesn't change on update
        throw new BadRequestException('Cannot link publications from different projects');
      }

      // 5. Post Type Compatibility
      const newPostType = data.postType || publication.postType;
      if (targetPub.postType !== newPostType) {
        throw new BadRequestException(
          `Cannot link publication of type ${newPostType} with ${targetPub.postType}`,
        );
      }

      if (targetPub.translationGroupId) {
        translationGroupId = targetPub.translationGroupId;
      } else {
        translationGroupId = randomUUID();
        await this.prisma.publication.update({
          where: { id: targetPub.id },
          data: { translationGroupId },
        });
        this.logger.log(
          `Created new translation group ${translationGroupId} for publication ${targetPub.id}`,
        );
      }
    }

    // 6. Validate Language Uniqueness in Group (Issue 1)
    // Only check if we are setting a NEW group ID or changing language
    // If translationGroupId is undefined, we use current publication's group (if we are checking language change)
    // Actually, if we update language OR update group, we must check.

    const effectiveGroupId =
      translationGroupId !== undefined ? translationGroupId : publication.translationGroupId;
    const effectiveLanguage = data.language || publication.language;

    if (effectiveGroupId) {
      const existingTranslation = await this.prisma.publication.findFirst({
        where: {
          translationGroupId: effectiveGroupId,
          language: effectiveLanguage,
          id: { not: id }, // Exclude self
        },
      });

      if (existingTranslation) {
        throw new BadRequestException(
          `A publication with language ${effectiveLanguage} already exists in this translation group`,
        );
      }
    }

    // Business Rule: When status changes to DRAFT or READY
    if (data.status === PublicationStatus.DRAFT || data.status === PublicationStatus.READY) {
      // Validate content is filled for READY status
      if (data.status === PublicationStatus.READY) {
        const contentToCheck = data.content !== undefined ? data.content : publication.content;

        // Check for media presence (either in update data or existing)
        const isMediaUpdating = data.media !== undefined || data.existingMediaIds !== undefined;
        const newMediaCount = (data.media?.length || 0) + (data.existingMediaIds?.length || 0);
        const hasMedia = isMediaUpdating
          ? newMediaCount > 0
          : publication.media && publication.media.length > 0;

        if (!contentToCheck && !hasMedia) {
          throw new BadRequestException('Content or Media is required when status is READY');
        }
      }

      // Reset scheduledAt
      data.scheduledAt = null;

      // Reset all posts to PENDING
      await this.prisma.post.updateMany({
        where: { publicationId: id },
        data: {
          status: PostStatus.PENDING,
          scheduledAt: null,
          errorMessage: null,
          publishedAt: null,
        },
      });
    }

    // Business Rule: When scheduledAt is set OR status is explicitly set to SCHEDULED
    const isScheduling =
      (data.scheduledAt !== undefined && data.scheduledAt !== null) ||
      data.status === PublicationStatus.SCHEDULED;

    if (isScheduling) {
      // Validate that we have a scheduled time
      const effectiveScheduledAt =
        data.scheduledAt !== undefined ? data.scheduledAt : publication.scheduledAt;

      if (!effectiveScheduledAt) {
        throw new BadRequestException('Cannot set status to SCHEDULED without a scheduled time');
      }

      // Validate content is filled
      const contentToCheck = data.content !== undefined ? data.content : publication.content;

      // Check for media presence (either in update data or existing)
      const isMediaUpdating = data.media !== undefined || data.existingMediaIds !== undefined;
      const newMediaCount = (data.media?.length || 0) + (data.existingMediaIds?.length || 0);
      const hasMedia = isMediaUpdating
        ? newMediaCount > 0
        : publication.media && publication.media.length > 0;

      if (!contentToCheck && !hasMedia) {
        throw new BadRequestException('Content or Media is required when setting scheduledAt');
      }

      // STRICT VALIDATION: Check media and content against all channels
      const { validatePostContent } =
        await import('../../common/validators/social-media-validation.validator.js');

      const posts = await this.prisma.post.findMany({
        where: { publicationId: id },
        include: { channel: true },
      });

      for (const post of posts) {
        const postContent = post.content || contentToCheck;
        const validationResult = validatePostContent({
          content: postContent,
          mediaCount: hasMedia ? (isMediaUpdating ? newMediaCount : publication.media.length) : 0,
          socialMedia: post.channel.socialMedia as any,
          media: isMediaUpdating
            ? [
                ...(data.media || []).map(m => ({ type: m.type })),
                ...((await this.prisma.media.findMany({
                  where: {
                    id: {
                      in: (data.existingMediaIds || []).map(item => this.getMediaInput(item).id),
                    },
                  },
                  select: { type: true },
                })) as any),
              ]
            : publication.media?.filter(m => m.media).map(m => ({ type: m.media!.type })) || [],
          postType: data.postType || publication.postType,
        });

        if (!validationResult.isValid) {
          throw new BadRequestException(
            `Cannot schedule: Media/Content validation failed for ${post.channel.name}: ${validationResult.errors.join('; ')}`,
          );
        }
      }

      // Automatically set status to SCHEDULED
      data.status = PublicationStatus.SCHEDULED;

      // Reset all posts to PENDING and sync scheduledAt
      // This allows "restarting" a failed publication or rescheduling it entirely
      await this.prisma.post.updateMany({
        where: {
          publicationId: id,
        },
        data: {
          status: PostStatus.PENDING,
          errorMessage: null,
          scheduledAt: null, // Clear post-specific schedule to fallback to publication's one
          publishedAt: null,
        },
      });
    }

    // Validation: If content OR media is updating, we must check all posts that inherit this content/media
    const isMediaUpdating = data.media !== undefined || data.existingMediaIds !== undefined;
    const isContentUpdating = data.content !== undefined && data.content !== null;

    if (isContentUpdating || isMediaUpdating) {
      // Find posts that are not published
      const activePosts = await this.prisma.post.findMany({
        where: {
          publicationId: id,
          status: { notIn: [PostStatus.PUBLISHED] },
        },
        include: {
          channel: true,
        },
      });

      if (activePosts.length > 0) {
        const { validatePostContent } =
          await import('../../common/validators/social-media-validation.validator.js');

        let mediaCount = publication.media?.length || 0;
        let mediaArray =
          publication.media?.filter(m => m.media).map(m => ({ type: m.media!.type })) || [];

        if (isMediaUpdating) {
          mediaCount = (data.media?.length || 0) + (data.existingMediaIds?.length || 0);
          // For simplicity in reactive Failure, we'll fetch the media types if needed or just use passed DTO
          // In practice, if media is updating, we have the new array in DTO (merged in logic above)
          mediaArray = [
            ...(data.media || []).map(m => ({ type: m.type })),
            ...((await this.prisma.media.findMany({
              where: {
                id: { in: (data.existingMediaIds || []).map(item => this.getMediaInput(item).id) },
              },
              select: { type: true },
            })) as any),
          ];
        }

        const failedPosts: Array<{ postId: string; channelName: string; errors: string[] }> = [];

        for (const post of activePosts) {
          const postContent =
            post.content || (isContentUpdating ? data.content : publication.content);
          const validationResult = validatePostContent({
            content: postContent,
            mediaCount: mediaCount,
            socialMedia: post.channel.socialMedia as any,
            media: mediaArray,
            postType: data.postType || publication.postType,
          });

          if (!validationResult.isValid) {
            failedPosts.push({
              postId: post.id,
              channelName: post.channel.name,
              errors: validationResult.errors,
            });
          }
        }

        // If any posts have validation errors
        if (failedPosts.length > 0) {
          // Rule: If status is non-draft/non-ready, drop to FAILED
          const currentStatus = data.status || publication.status;
          const shouldDropToFailed =
            currentStatus !== PublicationStatus.DRAFT && currentStatus !== PublicationStatus.READY;

          if (shouldDropToFailed) {
            this.logger.warn(
              `Publication ${id} update: ${failedPosts.length} posts have validation errors. Dropping to FAILED.`,
            );

            // Update each failed post with FAILED status and error message
            for (const failed of failedPosts) {
              const errorMessage = `Validation failed for ${failed.channelName}: ${failed.errors.join('; ')}`;
              await this.prisma.post.update({
                where: { id: failed.postId },
                data: {
                  status: PostStatus.FAILED,
                  errorMessage,
                },
              });
            }

            // Set publication status to FAILED as well
            data.status = PublicationStatus.FAILED;
          } else {
            // If it's DRAFT or READY, we just log it, UI handles blocking
            this.logger.log(
              `Publication ${id} (${currentStatus}) has ${failedPosts.length} validation errors but remains in current status.`,
            );
          }
        }
      }
    }

    const updated = await this.prisma.publication.update({
      where: { id },
      data: {
        projectId: data.projectId !== undefined ? data.projectId : undefined,
        title: data.title,
        description: data.description,
        content: data.content,
        authorComment: data.authorComment,
        // Update Media: Replace all existing with new list if any media field is provided
        // Logic: if any media DTO field is present, we assume full replace.
        // If all are undefined, we touch nothing.
        // Note: This logic assumes that the client sends the FULL state of media.
        media:
          data.media || data.existingMediaIds
            ? {
                deleteMany: {}, // Clear existing
                create: [
                  // New Media
                  ...(data.media || []).map((m, i) => ({
                    order: i,
                    media: { create: { ...m, meta: (m.meta || {}) as any } },
                  })),
                  // Existing Media
                  ...(data.existingMediaIds || []).map((item, i) => {
                    const input = this.getMediaInput(item);
                    return {
                      order: (data.media?.length || 0) + i,
                      mediaId: input.id,
                      hasSpoiler: input.hasSpoiler,
                    };
                  }),
                ],
              }
            : undefined,
        tags: data.tags,
        status: data.status,
        language: data.language,
        translationGroupId,
        postType: data.postType,
        postDate: data.postDate,
        scheduledAt: data.scheduledAt,
        meta: data.meta ? { ...(publication.meta as any), ...(data.meta as any) } : undefined,
        note: data.note,
        sourceTexts:
          data.sourceTexts !== undefined
            ? ((data.appendSourceTexts
                ? [...publication.sourceTexts, ...data.sourceTexts]
                : data.sourceTexts) as any)
            : undefined,
      },
      include: this.PUBLICATION_WITH_RELATIONS_INCLUDE,
    });

    return {
      ...updated,
      meta: this.parseMetaJson(updated.meta),
      sourceTexts: this.parseSourceTextsJson(updated.sourceTexts),
    };
  }

  /**
   * Delete a publication.
   * Allowed for the author or project OWNER/ADMIN.
   *
   * @param id - The ID of the publication to remove.
   * @param userId - The ID of the user.
   */
  public async remove(id: string, userId: string) {
    const publication = await this.findOne(id, userId);

    // Check if user is author or has admin rights
    if (publication.createdBy !== userId) {
      if (publication.projectId) {
        await this.permissions.checkProjectPermission(publication.projectId, userId, [
          ProjectRole.ADMIN,
        ]);
      } else {
        throw new ForbiddenException('Access denied to personal draft');
      }
    }

    return this.prisma.publication.delete({
      where: { id },
    });
  }

  /**
   * Perform bulk operations on publications.
   *
   * @param userId - The ID of the user performing the operation.
   * @param dto - The bulk operation data.
   */
  public async bulkOperation(
    userId: string,
    dto: import('./dto/bulk-operation.dto.js').BulkOperationDto,
  ) {
    const { ids, operation, status } = dto;

    if (!ids || ids.length === 0) {
      return { count: 0 };
    }

    // 1. Verify access to all publications or filter those that user has access to
    // For simplicity and safety, we'll fetch them and check permissions
    // Alternatively, we could do a complex updateMany with where: { id: { in: ids }, projectId: { in: ... } }

    const publications = await this.prisma.publication.findMany({
      where: { id: { in: ids } },
      select: { id: true, projectId: true, createdBy: true },
    });

    const authorizedIds: string[] = [];

    for (const pub of publications) {
      try {
        if (pub.createdBy !== userId) {
          if (pub.projectId) {
            await this.permissions.checkProjectPermission(pub.projectId, userId, [
              ProjectRole.ADMIN,
            ]);
          } else {
            throw new ForbiddenException('Access denied to personal draft');
          }
        }
        authorizedIds.push(pub.id);
      } catch (e) {
        this.logger.warn(
          `User ${userId} attempted bulk ${operation} on publication ${pub.id} without permission`,
        );
      }
    }

    if (authorizedIds.length === 0) {
      return { count: 0 };
    }

    switch (operation) {
      case 'DELETE':
        return this.prisma.publication.deleteMany({
          where: { id: { in: authorizedIds } },
        });

      case 'ARCHIVE':
        return this.prisma.publication.updateMany({
          where: { id: { in: authorizedIds } },
          data: { archivedAt: new Date(), archivedBy: userId },
        });

      case 'UNARCHIVE':
        return this.prisma.publication.updateMany({
          where: { id: { in: authorizedIds } },
          data: { archivedAt: null, archivedBy: null },
        });

      case 'SET_STATUS':
        if (!status) {
          throw new BadRequestException('Status is required for status operation');
        }

        // Special handling for READY status - normally require content
        // For bulk status change, we'll just set it, assuming user knows what they are doing
        // OR we can reuse the logic from update() but it's more complex for updateMany

        if (status === PublicationStatus.DRAFT || status === PublicationStatus.READY) {
          // Reset all posts to PENDING
          await this.prisma.post.updateMany({
            where: { publicationId: { in: authorizedIds } },
            data: {
              status: PostStatus.PENDING,
              scheduledAt: null,
              errorMessage: null,
              publishedAt: null,
            },
          });

          return this.prisma.publication.updateMany({
            where: { id: { in: authorizedIds } },
            data: { status, scheduledAt: null },
          });
        }

        // For other statuses (e.g. SCHEDULED), we might need more validation
        // But for bulk, we usually only allow DRAFT/READY or maybe ARCHIVE (handled above)
        return this.prisma.publication.updateMany({
          where: { id: { in: authorizedIds } },
          data: { status },
        });

      default:
        throw new BadRequestException(`Unsupported operation: ${operation}`);
    }
  }

  /**
   * Generate individual posts for specified channels from a publication.
   * Posts inherit content from the publication automatically.
   * Verifies that all channels belong to the same project as the publication.
   *
   * @param publicationId - The ID of the source publication.
   * @param channelIds - List of channel IDs to create posts for.
   * @param userId - Optional user ID (if authenticated request).
   * @param scheduledAt - Optional schedule time for the posts.
   * @returns The created posts.
   */
  public async createPostsFromPublication(
    publicationId: string,
    channelIds: string[],
    userId?: string,
    scheduledAt?: Date,
  ) {
    // Validate channelIds is not empty
    if (!channelIds || channelIds.length === 0) {
      throw new BadRequestException('At least one channel must be specified');
    }

    let publication;

    if (userId) {
      publication = await this.findOne(publicationId, userId);
    } else {
      // System/External fetch
      publication = await this.prisma.publication.findUnique({
        where: { id: publicationId },
      });
      if (!publication) {
        throw new NotFoundException('Publication not found');
      }
    }

    if (!publication.projectId) {
      throw new BadRequestException('Cannot create posts for personal drafts');
    }

    // Verify all channels belong to the same project
    const channels = await this.prisma.channel.findMany({
      where: {
        id: { in: channelIds },
        projectId: publication.projectId,
      },
    });

    if (channels.length !== channelIds.length) {
      throw new NotFoundException('Some channels not found or do not belong to this project');
    }

    // Create posts for each channel (content comes from publication via relation)
    const posts = await Promise.all(
      channels.map(async channel => {
        // Find default signature for this user and channel
        // Resolve author signature content
        let authorSignature = undefined;
        if (userId) {
          const defaultSignature = await this.prisma.authorSignature.findFirst({
            where: { userId, channelId: channel.id, isDefault: true },
            select: { content: true },
          });
          if (defaultSignature) {
            authorSignature = defaultSignature.content;
          }
        }

        return this.prisma.post.create({
          data: {
            publicationId: publication.id,
            channelId: channel.id,
            socialMedia: channel.socialMedia,
            status: PostStatus.PENDING,
            scheduledAt: scheduledAt ?? publication.scheduledAt,
            meta: {},
            authorSignature,
          },
          include: {
            channel: true,
            publication: true, // Include full publication with content
          },
        });
      }),
    );

    return posts;
  }

  /**
   * Add media files to an existing publication.
   * Appends new media to the end of the existing media list.
   *
   * @param publicationId - The ID of the publication.
   * @param userId - The ID of the user.
   * @param media - Array of media items to add.
   * @returns The updated publication.
   */
  public async addMedia(publicationId: string, userId: string, media: any[]) {
    const publication = await this.findOne(publicationId, userId);

    // Check if user is author or has admin rights
    if (publication.createdBy !== userId) {
      if (publication.projectId) {
        await this.permissions.checkProjectPermission(publication.projectId, userId, [
          ProjectRole.ADMIN,
        ]);
      } else {
        throw new ForbiddenException('Access denied to personal draft');
      }
    }

    // Get the current max order
    const existingMedia = await this.prisma.publicationMedia.findMany({
      where: { publicationId },
      orderBy: { order: 'desc' },
      take: 1,
    });

    const startOrder = existingMedia.length > 0 ? existingMedia[0].order + 1 : 0;

    // Use transaction to ensure atomicity
    await this.prisma.$transaction(async tx => {
      for (let i = 0; i < media.length; i++) {
        const m = media[i];
        const input = this.getMediaInput(m);
        let mediaId = input.id;
        const hasSpoiler = input.hasSpoiler;

        if (!mediaId) {
          const mediaItem = await tx.media.create({
            data: {
              type: m.type,
              storageType: m.storageType,
              storagePath: m.storagePath,
              filename: m.filename,
              mimeType: m.mimeType,
              sizeBytes: m.sizeBytes,
              meta: m.meta || {},
            },
          });
          mediaId = mediaItem.id;
        }

        await tx.publicationMedia.create({
          data: {
            publicationId,
            mediaId,
            order: startOrder + i,
            hasSpoiler,
          },
        });
      }
    });

    this.logger.log(`Added ${media.length} media items to publication ${publicationId}`);
    return this.findOne(publicationId, userId);
  }

  /**
   * Remove a media file from a publication.
   *
   * @param publicationId - The ID of the publication.
   * @param userId - The ID of the user.
   * @param mediaId - The ID of the media to remove.
   * @returns Success status.
   */
  public async removeMedia(publicationId: string, userId: string, mediaId: string) {
    const publication = await this.findOne(publicationId, userId);

    // Check if user is author or has admin rights
    if (publication.createdBy !== userId) {
      if (publication.projectId) {
        await this.permissions.checkProjectPermission(publication.projectId, userId, [
          ProjectRole.ADMIN,
        ]);
      } else {
        throw new ForbiddenException('Access denied to personal draft');
      }
    }

    // Find the publication media entry
    const pubMedia = await this.prisma.publicationMedia.findFirst({
      where: {
        publicationId,
        mediaId,
      },
    });

    if (!pubMedia) {
      throw new NotFoundException('Media not found in this publication');
    }

    // Delete the publication media link
    await this.prisma.publicationMedia.delete({
      where: { id: pubMedia.id },
    });

    return { success: true };
  }

  /**
   * Reorder media files in a publication.
   *
   * @param publicationId - The ID of the publication.
   * @param userId - The ID of the user.
   * @param mediaOrder - Array of media IDs with their new order.
   * @returns Success status.
   */
  public async reorderMedia(
    publicationId: string,
    userId: string,
    mediaOrder: Array<{ id: string; order: number }>,
  ) {
    const publication = await this.findOne(publicationId, userId);

    // Check if user is author or has admin rights
    if (publication.createdBy !== userId) {
      if (publication.projectId) {
        await this.permissions.checkProjectPermission(publication.projectId, userId, [
          ProjectRole.ADMIN,
        ]);
      } else {
        throw new ForbiddenException('Access denied to personal draft');
      }
    }

    // Update order for each media item in a transaction
    await this.prisma.$transaction(
      mediaOrder.map(({ id, order }) =>
        this.prisma.publicationMedia.updateMany({
          where: {
            publicationId,
            id,
          },
          data: {
            order,
          },
        }),
      ),
    );

    this.logger.log(`Reordered ${mediaOrder.length} media items in publication ${publicationId}`);
    return { success: true };
  }

  /**
   * Update a specific media link properties in a publication.
   *
   * @param publicationId - The ID of the publication.
   * @param userId - The ID of the user.
   * @param mediaLinkId - The ID of the publication-media link (not media itself).
   * @param data - The data to update (hasSpoiler, order).
   * @returns The updated media link.
   */
  public async updateMediaLink(
    publicationId: string,
    userId: string,
    mediaLinkId: string,
    data: { hasSpoiler?: boolean; order?: number },
  ) {
    const publication = await this.findOne(publicationId, userId);

    // Check if user is author or has admin rights
    if (publication.createdBy !== userId) {
      if (publication.projectId) {
        await this.permissions.checkProjectPermission(publication.projectId, userId, [
          ProjectRole.ADMIN,
        ]);
      } else {
        throw new ForbiddenException('Access denied to personal draft');
      }
    }

    return this.prisma.publicationMedia.update({
      where: {
        id: mediaLinkId,
        publicationId,
      },
      data: {
        hasSpoiler: data.hasSpoiler,
        order: data.order,
      },
    });
  }
}
