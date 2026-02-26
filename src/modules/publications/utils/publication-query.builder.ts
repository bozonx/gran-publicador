import {
  PublicationStatus,
  PostType,
  type Prisma,
  type SocialMedia,
} from '../../../generated/prisma/index.js';
import { IssueType, OwnershipType } from '../dto/index.js';
import { normalizeTags } from '../../../common/utils/tags.util.js';

/**
 * Helper class to build Prisma WHERE clauses for Publications.
 * Enhances SOLID by separating query construction logic from the main service.
 */
export class PublicationQueryBuilder {
  private static readonly ALLOWED_SORT_FIELDS = new Set([
    'chronology',
    'byScheduled',
    'byPublished',
    'createdAt',
    'scheduledAt',
    'postDate',
  ]);

  /**
   * Build WHERE clause for publication queries with filters.
   */
  public static buildWhere(
    userId: string,
    projectId?: string,
    filters?: {
      status?: PublicationStatus | PublicationStatus[];
      includeArchived?: boolean;
      archivedOnly?: boolean;
      channelId?: string;
      socialMedia?: SocialMedia;
      ownership?: OwnershipType;
      issueType?: IssueType;
      search?: string;
      language?: string;
      tags?: string[];
      publishedAfter?: Date;
      withMedia?: boolean;
    },
    userAllowedProjectIds?: string[],
  ): Prisma.PublicationWhereInput {
    const where: Prisma.PublicationWhereInput = {};
    const conditions: Prisma.PublicationWhereInput[] = [];

    // Media filter
    if (filters?.withMedia) {
      conditions.push({
        media: {
          some: {},
        },
      });
    }

    // Project filter & Scoping
    if (projectId) {
      where.projectId = projectId;
    } else if (userAllowedProjectIds) {
      where.projectId = { in: userAllowedProjectIds };
    } else {
      where.project = {
        members: {
          some: { userId },
        },
      };
    }

    // Archive filter
    if (filters?.archivedOnly) {
      where.archivedAt = { not: null };
    } else if (!filters?.includeArchived) {
      where.archivedAt = null;
      if (where.project) {
        (where.project as any).archivedAt = null;
      } else {
        where.project = { archivedAt: null };
      }
    }

    // Status filter
    if (filters?.status) {
      if (Array.isArray(filters.status)) {
        where.status = { in: filters.status };
      } else {
        where.status = filters.status;
      }
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
            { posts: { some: { status: PostStatus.FAILED } } },
          ],
        });
      } else if (filters.issueType === IssueType.PARTIAL) {
        where.status = PublicationStatus.PARTIAL;
      } else if (filters.issueType === IssueType.EXPIRED) {
        where.status = PublicationStatus.EXPIRED;
      } else if (filters.issueType === IssueType.PROBLEMATIC) {
        conditions.push({
          OR: [
            { status: PublicationStatus.FAILED },
            { status: PublicationStatus.PARTIAL },
            { status: PublicationStatus.EXPIRED },
            { posts: { some: { status: PostStatus.FAILED } } },
          ],
        });
      }
    }

    // Text search
    if (filters?.search) {
      conditions.push({
        OR: [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
          { content: { contains: filters.search, mode: 'insensitive' } },
        ],
      });
    }

    // Filter by language
    if (filters?.language) {
      where.language = filters.language;
    }

    // Filter by tags
    if (filters?.tags) {
      const tagList = normalizeTags(filters.tags);
      if (tagList.length > 0) {
        // We use AND to ensure the publication has ALL of the specified tags
        tagList.forEach(tag => {
          conditions.push({
            tagObjects: {
              some: {
                normalizedName: tag.toLowerCase(),
              },
            },
          });
        });
      }
    }

    // Filter by publication date (last 24h for example)
    if (filters?.publishedAfter) {
      conditions.push({
        posts: {
          some: {
            publishedAt: { gte: filters.publishedAfter },
            status: PostStatus.PUBLISHED,
          },
        },
      });
    }

    // Apply AND conditions
    if (conditions.length > 0) {
      where.AND = conditions;
    }

    return where;
  }

  /**
   * Determine the primary ORDER BY clause for Prisma.
   */
  public static getOrderBy(
    sortField: string,
    sortDirection: 'asc' | 'desc',
  ): Prisma.PublicationOrderByWithRelationInput[] {
    if (!this.ALLOWED_SORT_FIELDS.has(sortField)) {
      sortField = 'chronology';
    }

    if (sortField === 'chronology') {
      return [{ effectiveAt: sortDirection }, { id: sortDirection }];
    }

    if (sortField === 'byScheduled') {
      return [
        { scheduledAt: { sort: sortDirection, nulls: 'last' } },
        { createdAt: sortDirection },
        { id: sortDirection },
      ];
    }

    if (sortField === 'byPublished') {
      // We can't sort by aggregate of related posts easily in Prisma
      // Fallback to createdAt or use separate field
      return [{ createdAt: sortDirection }, { id: sortDirection }];
    }

    if (sortField === 'postDate') {
      return [{ postDate: { sort: sortDirection, nulls: 'last' } }, { id: sortDirection }];
    }

    // Default standard fields
    const orderBy: any = {};
    orderBy[sortField] = sortDirection;
    return [orderBy, { id: sortDirection }];
  }
}

// Re-export required types if needed
enum PostStatus {
  PENDING = 'PENDING',
  FAILED = 'FAILED',
  PUBLISHED = 'PUBLISHED',
}
