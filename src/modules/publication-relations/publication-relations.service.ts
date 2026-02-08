import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { RelationGroupType, PublicationStatus } from '../../generated/prisma/index.js';

import { PrismaService } from '../prisma/prisma.service.js';
import { PermissionsService } from '../../common/services/permissions.service.js';
import { PermissionKey } from '../../common/types/permissions.types.js';
import type { LinkPublicationDto } from './dto/link-publication.dto.js';
import type { UnlinkPublicationDto } from './dto/unlink-publication.dto.js';
import type { ReorderGroupDto } from './dto/reorder-group.dto.js';
import type { CreateRelatedPublicationDto } from './dto/create-related-publication.dto.js';

@Injectable()
export class PublicationRelationsService {
  private readonly logger = new Logger(PublicationRelationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  /**
   * Get all relation groups for a publication.
   */
  public async getRelations(publicationId: string, userId: string) {
    const publication = await this.getPublicationOrThrow(publicationId);
    await this.permissions.checkProjectAccess(publication.projectId, userId);

    const items = await this.prisma.publicationRelationItem.findMany({
      where: { publicationId },
      include: {
        group: {
          include: {
            items: {
              include: {
                publication: {
                  select: {
                    id: true,
                    title: true,
                    language: true,
                    postType: true,
                    status: true,
                    archivedAt: true,
                    posts: {
                      select: {
                        channel: {
                          select: {
                            id: true,
                            name: true,
                            isActive: true,
                            archivedAt: true,
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
                  },
                },
              },
              orderBy: { position: 'asc' as const },
            },
          },
        },
      },
    });

    return items.map(i => i.group);
  }

  /**
   * Link current publication to another publication via a relation group.
   * If the target already belongs to a group of the same type, join that group.
   * Otherwise create a new group.
   */
  public async link(publicationId: string, userId: string, dto: LinkPublicationDto) {
    const source = await this.getPublicationOrThrow(publicationId);
    const target = await this.getPublicationOrThrow(dto.targetPublicationId);

    // Validate permissions
    await this.checkUpdatePermission(source, userId);
    await this.permissions.checkProjectAccess(target.projectId, userId);

    // Validate constraints
    if (publicationId === dto.targetPublicationId) {
      throw new BadRequestException('Cannot link publication to itself');
    }

    if (source.projectId !== target.projectId) {
      throw new BadRequestException('Cannot link publications from different projects');
    }

    if (source.postType !== target.postType) {
      throw new BadRequestException(
        `Cannot link publications with different post types: ${source.postType} vs ${target.postType}`,
      );
    }

    // Check if source already has a group of this type
    const sourceExistingItem = await this.prisma.publicationRelationItem.findFirst({
      where: {
        publicationId,
        group: { type: dto.type },
      },
    });

    if (dto.type === RelationGroupType.SERIES && sourceExistingItem) {
      throw new BadRequestException('Publication already belongs to a SERIES group');
    }

    if (dto.type === RelationGroupType.LOCALIZATION && sourceExistingItem) {
      throw new BadRequestException('Publication already belongs to a LOCALIZATION group');
    }

    // Check if target already belongs to a group of this type
    const targetExistingItem = await this.prisma.publicationRelationItem.findFirst({
      where: {
        publicationId: dto.targetPublicationId,
        group: { type: dto.type },
      },
      include: { group: { include: { items: true } } },
    });

    // For LOCALIZATION: validate language uniqueness
    if (dto.type === RelationGroupType.LOCALIZATION && targetExistingItem) {
      const existingLanguages = await this.getGroupLanguages(targetExistingItem.groupId);
      if (existingLanguages.includes(source.language)) {
        throw new BadRequestException(
          `A publication with language "${source.language}" already exists in this localization group`,
        );
      }
    }

    return this.prisma.$transaction(async tx => {
      let groupId: string;
      let nextPosition: number;

      if (targetExistingItem) {
        // Join existing group
        groupId = targetExistingItem.groupId;
        const maxPos = await tx.publicationRelationItem.aggregate({
          where: { groupId },
          _max: { position: true },
        });
        nextPosition = (maxPos._max.position ?? -1) + 1;
      } else {
        // Create new group with target as first member
        const group = await tx.publicationRelationGroup.create({
          data: {
            projectId: source.projectId,
            type: dto.type,
            createdBy: userId,
          },
        });
        groupId = group.id;

        await tx.publicationRelationItem.create({
          data: {
            groupId,
            publicationId: dto.targetPublicationId,
            position: 0,
          },
        });
        nextPosition = 1;
      }

      // Add source publication to the group
      await tx.publicationRelationItem.create({
        data: {
          groupId,
          publicationId,
          position: nextPosition,
        },
      });

      this.logger.log(`Linked publication ${publicationId} to group ${groupId} (type=${dto.type})`);

      return { groupId };
    });
  }

  /**
   * Unlink a publication from a relation group.
   * If the group has <= 1 member after removal, delete the group entirely.
   */
  public async unlink(publicationId: string, userId: string, dto: UnlinkPublicationDto) {
    const publication = await this.getPublicationOrThrow(publicationId);
    await this.checkUpdatePermission(publication, userId);

    const item = await this.prisma.publicationRelationItem.findFirst({
      where: {
        publicationId,
        groupId: dto.groupId,
      },
    });

    if (!item) {
      throw new NotFoundException('Publication is not a member of this group');
    }

    return this.prisma.$transaction(async tx => {
      // Remove the item
      await tx.publicationRelationItem.delete({
        where: { id: item.id },
      });

      // Check remaining members
      const remaining = await tx.publicationRelationItem.count({
        where: { groupId: dto.groupId },
      });

      if (remaining <= 1) {
        // Delete the group (cascade deletes remaining items)
        await tx.publicationRelationGroup.delete({
          where: { id: dto.groupId },
        });
        this.logger.log(`Deleted relation group ${dto.groupId} (no members left)`);
      } else {
        // Re-compact positions
        const items = await tx.publicationRelationItem.findMany({
          where: { groupId: dto.groupId },
          orderBy: { position: 'asc' },
        });

        for (let i = 0; i < items.length; i++) {
          if (items[i].position !== i) {
            await tx.publicationRelationItem.update({
              where: { id: items[i].id },
              data: { position: i },
            });
          }
        }
      }

      this.logger.log(`Unlinked publication ${publicationId} from group ${dto.groupId}`);
      return { success: true };
    });
  }

  /**
   * Reorder publications within a relation group.
   */
  public async reorder(groupId: string, userId: string, dto: ReorderGroupDto) {
    const group = await this.prisma.publicationRelationGroup.findUnique({
      where: { id: groupId },
      include: { items: true },
    });

    if (!group) {
      throw new NotFoundException('Relation group not found');
    }

    await this.permissions.checkProjectAccess(group.projectId, userId);

    // Validate all publication IDs belong to this group
    const existingPubIds = new Set(group.items.map(i => i.publicationId));
    for (const item of dto.items) {
      if (!existingPubIds.has(item.publicationId)) {
        throw new BadRequestException(
          `Publication ${item.publicationId} is not a member of this group`,
        );
      }
    }

    // Validate positions are unique and sequential from 0
    const positions = dto.items.map(i => i.position).sort((a, b) => a - b);
    for (let i = 0; i < positions.length; i++) {
      if (positions[i] !== i) {
        throw new BadRequestException('Positions must be sequential starting from 0');
      }
    }

    // Use a two-phase approach to avoid unique constraint violations:
    // Phase 1: Set all positions to negative temporary values
    // Phase 2: Set to final values
    await this.prisma.$transaction(async tx => {
      for (const item of dto.items) {
        const existing = group.items.find(i => i.publicationId === item.publicationId);
        if (existing) {
          await tx.publicationRelationItem.update({
            where: { id: existing.id },
            data: { position: -(item.position + 1) },
          });
        }
      }

      for (const item of dto.items) {
        const existing = group.items.find(i => i.publicationId === item.publicationId);
        if (existing) {
          await tx.publicationRelationItem.update({
            where: { id: existing.id },
            data: { position: item.position },
          });
        }
      }
    });

    this.logger.log(`Reordered group ${groupId}`);
    return { success: true };
  }

  /**
   * Create a new publication based on the source and immediately link them.
   */
  public async createRelated(
    publicationId: string,
    userId: string,
    dto: CreateRelatedPublicationDto,
  ) {
    const source = await this.getPublicationOrThrow(publicationId);
    await this.permissions.checkPermission(
      source.projectId,
      userId,
      PermissionKey.PUBLICATIONS_CREATE,
    );

    // Check if source already has a group of this type
    const sourceExistingItem = await this.prisma.publicationRelationItem.findFirst({
      where: {
        publicationId,
        group: { type: dto.type },
      },
      include: { group: { include: { items: true } } },
    });

    const language = dto.language || source.language;

    // For LOCALIZATION: validate language uniqueness
    if (dto.type === RelationGroupType.LOCALIZATION && sourceExistingItem) {
      const existingLanguages = await this.getGroupLanguages(sourceExistingItem.groupId);
      if (existingLanguages.includes(language)) {
        throw new BadRequestException(
          `A publication with language "${language}" already exists in this localization group`,
        );
      }
    }

    return this.prisma.$transaction(async tx => {
      // Create the new publication as a copy
      const newPublication = await tx.publication.create({
        data: {
          projectId: source.projectId,
          createdBy: userId,
          title: dto.title || source.title,
          description: source.description,
          content: source.content,
          authorComment: source.authorComment,
          tags: source.tags,
          postType: source.postType,
          language,
          meta: (source.meta as any) || {},
          note: source.note,
          postDate: source.postDate,
          status: PublicationStatus.DRAFT,
        },
      });

      // If the source already belongs to a group of this type, append to that group.
      if (sourceExistingItem) {
        const nextPosition =
          sourceExistingItem.group.items.reduce((max, i) => Math.max(max, i.position), -1) + 1;

        await tx.publicationRelationItem.create({
          data: {
            groupId: sourceExistingItem.groupId,
            publicationId: newPublication.id,
            position: nextPosition,
          },
        });

        this.logger.log(
          `Created related publication ${newPublication.id} from ${publicationId} in existing group ${sourceExistingItem.groupId} (type=${dto.type})`,
        );

        return { publicationId: newPublication.id, groupId: sourceExistingItem.groupId };
      }

      // Otherwise create a new group with the source + new publication.
      const group = await tx.publicationRelationGroup.create({
        data: {
          projectId: source.projectId,
          type: dto.type,
          createdBy: userId,
        },
      });

      await tx.publicationRelationItem.createMany({
        data: [
          { groupId: group.id, publicationId, position: 0 },
          { groupId: group.id, publicationId: newPublication.id, position: 1 },
        ],
      });

      this.logger.log(
        `Created related publication ${newPublication.id} from ${publicationId} in new group ${group.id} (type=${dto.type})`,
      );

      return { publicationId: newPublication.id, groupId: group.id };
    });
  }

  /**
   * Get the count of relation groups for a publication (for quick UI indicator).
   */
  public async getRelationsCount(publicationId: string): Promise<number> {
    return this.prisma.publicationRelationItem.count({
      where: { publicationId },
    });
  }

  // --- Private helpers ---

  private async getPublicationOrThrow(id: string) {
    const publication = await this.prisma.publication.findUnique({
      where: { id },
      select: {
        id: true,
        projectId: true,
        postType: true,
        language: true,
        createdBy: true,
        title: true,
        description: true,
        content: true,
        authorComment: true,
        tags: true,
        meta: true,
        note: true,
        postDate: true,
      },
    });

    if (!publication) {
      throw new NotFoundException('Publication not found');
    }

    return publication;
  }

  private async checkUpdatePermission(
    publication: { projectId: string; createdBy: string | null },
    userId: string,
  ) {
    if (publication.createdBy === userId) {
      await this.permissions.checkPermission(
        publication.projectId,
        userId,
        PermissionKey.PUBLICATIONS_UPDATE_OWN,
      );
    } else {
      await this.permissions.checkPermission(
        publication.projectId,
        userId,
        PermissionKey.PUBLICATIONS_UPDATE_ALL,
      );
    }
  }

  private async getGroupLanguages(groupId: string): Promise<string[]> {
    const items = await this.prisma.publicationRelationItem.findMany({
      where: { groupId },
      include: {
        publication: {
          select: { language: true },
        },
      },
    });

    return items.map(i => i.publication.language);
  }
}
