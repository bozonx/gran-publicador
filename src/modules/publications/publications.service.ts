import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PublicationStatus, PostStatus, PostType, Prisma, ProjectRole, SocialMedia } from '../../generated/prisma/client.js';
import { randomUUID } from 'node:crypto';

import { PermissionsService } from '../../common/services/permissions.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreatePublicationDto, UpdatePublicationDto, IssueType, OwnershipType } from './dto/index.js';

@Injectable()
export class PublicationsService {
  private readonly logger = new Logger(PublicationsService.name);

  constructor(
    private prisma: PrismaService,
    private permissions: PermissionsService,
  ) { }

  /**
   * Build WHERE clause for publication queries with filters.
   * Extracted to avoid code duplication between findAll and findAllForUser.
   */
  private buildWhereClause(
    filters: {
      status?: PublicationStatus;
      includeArchived?: boolean;
      channelId?: string;
      socialMedia?: SocialMedia;
      ownership?: OwnershipType;
      issueType?: IssueType;
      search?: string;
      language?: string;
    },
    userId: string,
    projectId?: string,
  ): Prisma.PublicationWhereInput {
    const where: Prisma.PublicationWhereInput = {};
    const conditions: Prisma.PublicationWhereInput[] = [];

    // Project filter (if provided)
    if (projectId) {
      where.projectId = projectId;
      // Archive filter for project-specific queries
      if (!filters?.includeArchived) {
        where.archivedAt = null;
        where.project = { archivedAt: null };
      }
    } else {
      // For user queries, filter by membership
      where.project = {
        members: {
          some: { userId },
        },
        archivedAt: null,
      };
      if (!filters?.includeArchived) {
        where.archivedAt = null;
      }
    }

    // Status filter
    if (filters?.status) {
      where.status = filters.status;
    }

    // Filter by channel (publications that have posts in this channel)
    if (filters?.channelId) {
      conditions.push({
        posts: {
          some: {
            channelId: filters.channelId,
          },
        },
      });
    }

    // Filter by Social Media
    if (filters?.socialMedia) {
      conditions.push({
        posts: {
          some: {
            channel: {
              socialMedia: filters.socialMedia,
            },
          },
        },
      });
    }

    // Filter by Ownership
    if (filters?.ownership) {
      if (filters.ownership === OwnershipType.OWN) {
        where.createdBy = userId;
      } else if (filters.ownership === OwnershipType.NOT_OWN) {
        where.createdBy = { not: userId };
      }
    }

    // Filter by Issue Type
    if (filters?.issueType) {
      if (filters.issueType === IssueType.FAILED) {
        conditions.push({
          OR: [
            { status: PublicationStatus.FAILED },
            { posts: { some: { status: PostStatus.FAILED } } }
          ]
        });
      } else if (filters.issueType === IssueType.PARTIAL) {
        where.status = PublicationStatus.PARTIAL;
      } else if (filters.issueType === IssueType.EXPIRED) {
        where.status = PublicationStatus.EXPIRED;
      }
    }

    // Text search across title, description, and content
    // Note: Using 'any' type assertion because SQLite types don't include 'mode' parameter,
    // but Prisma runtime supports it for case-insensitive search
    if (filters?.search) {
      (where as any).OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { content: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Filter by language
    if (filters?.language) {
      where.language = filters.language;
    }

    // Apply AND conditions
    if (conditions.length > 0) {
      where.AND = conditions;
    }

    return where;
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
    if (userId) {
      // Check if user has access to the project
      await this.permissions.checkProjectAccess(data.projectId, userId);
    }

    let translationGroupId = data.translationGroupId;

    if (data.linkToPublicationId) {
      // Logic to link to an existing publication
      // We must verify access to the target publication first
      // Assuming findOne checks access if userId is provided
      try {
        const targetPub = await this.findOne(data.linkToPublicationId, userId || ''); // If no userId, system bypass? findOne requires userId. 
        // If system call (no userId), we might need a bypass. 
        // But create says "If userId is provided...". If not provided, skip check.
        // For simplicity, let's assume if userId provided we assume we can read target.
        // Actually findOne throws if not found/no access.

        if (targetPub) {
          if (targetPub.translationGroupId) {
            translationGroupId = targetPub.translationGroupId;
          } else {
            translationGroupId = randomUUID();
            // Update target
            await this.prisma.publication.update({
              where: { id: targetPub.id },
              data: { translationGroupId },
            });
          }
        }
      } catch (e) {
        // If target not found or no access, ignore linking? or throw?
        // Let's log and ignore to not break creation, or better throw?
        // Throwing is safer.
        throw new NotFoundException(`Target publication for linking not found or inaccessible`);
      }
    }

    const publication = await this.prisma.publication.create({
      data: {
        projectId: data.projectId,
        createdBy: userId ?? null,
        title: data.title,
        description: data.description,
        content: data.content,
        authorComment: data.authorComment,
        mediaFiles: JSON.stringify(data.mediaFiles ?? []),
        tags: data.tags,
        status: data.status ?? PublicationStatus.DRAFT,
        language: data.language,
        translationGroupId,
        postType: data.postType ?? PostType.POST,
        postDate: data.postDate,
        scheduledAt: data.scheduledAt,
        meta: JSON.stringify(data.meta ?? {}),
      },
    });

    const author = userId ? `user ${userId}` : 'external system';
    this.logger.log(
      `Publication "${publication.title ?? publication.id}" created in project ${data.projectId} by ${author}`,
    );

    // Automatically create posts for specified channels
    if (data.channelIds && data.channelIds.length > 0) {
      await this.createPostsFromPublication(
        publication.id,
        data.channelIds,
        userId,
        undefined, // no scheduled time by default
      );
      this.logger.log(
        `Created ${data.channelIds.length} posts for publication ${publication.id}`,
      );
    }

    return publication;
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
      status?: PublicationStatus;
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
    },
  ) {
    await this.permissions.checkProjectAccess(projectId, userId);

    const where = this.buildWhereClause(filters || {}, userId, projectId);

    // Dynamic sorting
    const orderBy: Prisma.PublicationOrderByWithRelationInput = {};
    const sortField = filters?.sortBy || 'createdAt';
    const sortDirection = filters?.sortOrder || 'desc';
    (orderBy as any)[sortField] = sortDirection;

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

    return { items, total };
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
      status?: PublicationStatus;
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
    },
  ) {
    // 1. Get all projects where user is a member
    const userProjects = await this.prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true },
    });
    const userProjectIds = userProjects.map(p => p.projectId);

    if (userProjectIds.length === 0) {
      return { items: [], total: 0 };
    }

    // 2. Build filter with explicit projectId list
    const where = this.buildWhereClause(filters || {}, userId);
    
    // Override the project relation filter from buildWhereClause with explicit IN clause
    // buildWhereClause adds 'project: { members... }'. We want to replace/simplify that.
    // Actually, buildWhereClause is private. Let's look at it.
    // It adds: where.project = { members: { some: { userId } }, archivedAt: null }
    // We want to remove that and strictly use projectId IN list.
    // But buildWhereClause assumes it's handling the security check.
    
    // Let's modify buildWhereClause usage or manually construct where here to be safe.
    // Since we can't easily change buildWhereClause without affecting findAll, 
    // we can just OVERWRITE where.project and where.projectId.
    
    // Re-construct basic where without buildWhereClause for clarity and safety in this new approach?
    // Or just patch the result of buildWhereClause.
    
    // buildWhereClause logic:
    /*
      where.project = {
        members: { some: { userId } },
        archivedAt: null,
      };
      if (!filters?.includeArchived) {
        where.archivedAt = null;
      }
    */
    
    // We want:
    // where.projectId = { in: userProjectIds }
    // where.project = { archivedAt: null } (if needed) or just trust userProjectIds are mostly valid? 
    // userProjectIds includes archived projects?
    // projectMember exists for archived projects? Yes.
    // So we still need to filter out archived projects if !includeArchived.
    
    // So:
    delete where.project; // Remove the complex member check
    
    where.projectId = { in: userProjectIds };
    
    if (!filters?.includeArchived) {
        where.project = { archivedAt: null }; // Only check for archived status
        where.archivedAt = null;
    }
    
    // The rest of buildWhereClause logic (status, channelId, etc.) is fine and preserved in 'where'
    // BUT buildWhereClause was called with userId.
    // It logic:
    /*
     } else {
      where.project = {
        members: {
          some: { userId },
        },
        archivedAt: null,
      };
      if (!filters?.includeArchived) {
        where.archivedAt = null;
      }
    }
    */
    
    // So if we delete where.project, we lose 'archivedAt: null' inside it.
    // So we must restore it.
     
    // Dynamic sorting
    const orderBy: Prisma.PublicationOrderByWithRelationInput = {};
    const sortField = filters?.sortBy || 'createdAt';
    const sortDirection = filters?.sortOrder || 'desc';
    (orderBy as any)[sortField] = sortDirection;

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

    return { items, total };
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
      include: {
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
            channel: true,
          },
        },
      },
    });

    if (!publication) {
      throw new NotFoundException('Publication not found');
    }

    await this.permissions.checkProjectAccess(publication.projectId, userId);

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
        },
      });
    }

    return { ...publication, translations };
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
      await this.permissions.checkProjectPermission(publication.projectId, userId, [
        ProjectRole.OWNER,
        ProjectRole.ADMIN,
      ]);
    }

    let translationGroupId = data.translationGroupId;

    if (data.linkToPublicationId) {
      try {
        const targetPub = await this.findOne(data.linkToPublicationId, userId);
        if (targetPub) {
          if (targetPub.translationGroupId) {
            translationGroupId = targetPub.translationGroupId;
          } else {
            translationGroupId = randomUUID();
            await this.prisma.publication.update({
              where: { id: targetPub.id },
              data: { translationGroupId },
            });
          }
        }
      } catch (e) {
        throw new NotFoundException(`Target publication for linking not found or inaccessible`);
      }
    }

    const updated = await this.prisma.publication.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        content: data.content,
        authorComment: data.authorComment,
        mediaFiles: data.mediaFiles ? JSON.stringify(data.mediaFiles) : undefined,
        tags: data.tags,
        status: data.status,
        language: data.language,
        translationGroupId,
        postType: data.postType,
        postDate: data.postDate,
        scheduledAt: data.scheduledAt,
        meta: data.meta ? JSON.stringify(data.meta) : undefined,
        errorMessage: data.errorMessage,
      },
    });

    return updated;
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
      await this.permissions.checkProjectPermission(publication.projectId, userId, [
        ProjectRole.OWNER,
        ProjectRole.ADMIN,
      ]);
    }

    return this.prisma.publication.delete({
      where: { id },
    });
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
      channels.map(channel =>
        this.prisma.post.create({
          data: {
            publicationId: publication.id,
            channelId: channel.id,
            socialMedia: channel.socialMedia,
            tags: null, // Can be overridden later, defaults to publication tags
            status: PostStatus.PENDING,
            scheduledAt: scheduledAt ?? publication.scheduledAt,
          },
          include: {
            channel: true,
            publication: true, // Include full publication with content
          },
        }),
      ),
    );

    return posts;
  }
}
