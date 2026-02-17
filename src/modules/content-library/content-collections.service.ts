import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { SystemRoleType } from '../../common/types/permissions.types.js';
import { PermissionsService } from '../../common/services/permissions.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ContentLibraryGroupType } from '../../generated/prisma/index.js';

@Injectable()
export class ContentCollectionsService {
  private readonly logger = new Logger(ContentCollectionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  public async withSerializableRetry<T>(operationName: string, fn: () => Promise<T>): Promise<T> {
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        const isRetryable =
          error?.code === 'P2034' ||
          (typeof error?.message === 'string' &&
            (error.message.includes('deadlock') || error.message.includes('could not serialize')));

        if (!isRetryable || attempt === maxRetries - 1) {
          throw error;
        }

        this.logger.warn(
          `Retrying serializable transaction for ${operationName} (attempt ${attempt + 2}/${maxRetries})`,
        );
      }
    }

    throw new Error(`Unreachable: serializable retry loop exhausted for ${operationName}`);
  }

  public resolveGroupType(collection: {
    type: unknown;
    groupType?: unknown;
    userId: string | null;
    projectId: string | null;
  }): 'PERSONAL_USER' | 'PROJECT_USER' | 'PROJECT_SHARED' {
    if ((collection.type as any) !== 'GROUP') {
      throw new BadRequestException('Collection is not a group');
    }

    if (
      collection.groupType === 'PERSONAL_USER' ||
      collection.groupType === 'PROJECT_USER' ||
      collection.groupType === 'PROJECT_SHARED'
    ) {
      return collection.groupType as any;
    }

    throw new BadRequestException('Invalid groupType: groupType is required for GROUP collections');
  }

  public async assertGroupAccess(options: {
    groupId: string;
    scope: 'personal' | 'project';
    projectId?: string;
    userId: string;
  }) {
    const collection = await this.prisma.contentCollection.findUnique({
      where: { id: options.groupId },
      select: { id: true, type: true, groupType: true, userId: true, projectId: true },
    });

    if (!collection) {
      throw new NotFoundException('Group not found');
    }

    if ((collection.type as any) !== 'GROUP') {
      throw new BadRequestException('Collection is not a group');
    }

    const resolvedGroupType = this.resolveGroupType(collection);

    if (options.scope === 'personal') {
      if (resolvedGroupType !== 'PERSONAL_USER' || collection.userId !== options.userId) {
        throw new ForbiddenException('You do not have access to this group');
      }
      return collection;
    }

    if (!options.projectId) {
      throw new BadRequestException('projectId is required for project scope');
    }

    if (collection.projectId !== options.projectId) {
      throw new ForbiddenException('Group does not belong to this project');
    }

    await this.permissions.checkProjectAccess(options.projectId, options.userId, true);

    if (resolvedGroupType === 'PROJECT_USER' && collection.userId !== options.userId) {
      throw new ForbiddenException('You do not have access to this group');
    }

    return collection;
  }

  public async assertCollectionAccess(options: {
    collectionId: string;
    scope: 'personal' | 'project';
    projectId?: string;
    userId: string;
    requireMutationPermission?: boolean;
  }) {
    const collection = await this.prisma.contentCollection.findUnique({
      where: { id: options.collectionId },
      select: {
        id: true,
        type: true,
        groupType: true,
        userId: true,
        projectId: true,
        parentId: true,
      },
    });

    if (!collection) {
      throw new NotFoundException('Collection not found');
    }

    if (options.scope === 'personal') {
      if (collection.projectId !== null || collection.userId !== options.userId) {
        throw new ForbiddenException('You do not have access to this collection');
      }

      if ((collection.type as any) === 'GROUP') {
        const groupType = this.resolveGroupType(collection);
        if (groupType !== 'PERSONAL_USER') {
          throw new ForbiddenException('You do not have access to this collection');
        }
      }
      return collection;
    }

    if (!options.projectId) {
      throw new BadRequestException('projectId is required for project scope');
    }

    if (collection.projectId !== options.projectId) {
      throw new ForbiddenException('Collection does not belong to this project');
    }

    await this.permissions.checkProjectAccess(options.projectId, options.userId, true);

    if ((collection.type as any) === 'SAVED_VIEW') {
      if (collection.userId !== options.userId) {
        throw new ForbiddenException('You do not have access to this collection');
      }
      if (options.requireMutationPermission) {
        await this.assertNotViewer(options.projectId, options.userId);
      }
      return collection;
    }

    const groupType = this.resolveGroupType(collection);
    if (groupType === 'PROJECT_USER' && collection.userId !== options.userId) {
      throw new ForbiddenException('You do not have access to this collection');
    }

    if (options.requireMutationPermission) {
      if (groupType === 'PROJECT_SHARED') {
        await this.assertProjectOwnerOrAdmin(options.projectId, options.userId);
      } else {
        await this.assertNotViewer(options.projectId, options.userId);
      }
    }

    return collection;
  }

  public async assertNotViewer(projectId: string, userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });
    if (user?.isAdmin) {
      return;
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        ownerId: true,
        members: {
          where: { userId },
          select: { role: { select: { systemType: true } } },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (project.ownerId === userId) {
      return;
    }
    if (project.members.length === 0) {
      throw new ForbiddenException('You do not have access to this project');
    }

    const roleSystemType = project.members[0]?.role?.systemType;
    if (roleSystemType === SystemRoleType.VIEWER) {
      throw new ForbiddenException('Viewers cannot perform this action');
    }
  }

  public async assertProjectOwnerOrAdmin(projectId: string, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });
    if (user?.isAdmin) {
      return;
    }
    await this.assertProjectOwner(projectId, userId);
  }

  public async assertProjectOwner(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (project.ownerId !== userId) {
      throw new ForbiddenException('Only project owner can perform this action');
    }
  }

  public async resolveParentGroupId(options: {
    parentId?: string | null;
    scope: 'personal' | 'project';
    projectId?: string;
    userId: string;
    childGroupType?: 'PERSONAL_USER' | 'PROJECT_USER' | 'PROJECT_SHARED';
  }): Promise<string | null | undefined> {
    if (options.parentId === undefined) {
      return undefined;
    }

    if (options.parentId === null) {
      return null;
    }

    const parent = await this.assertGroupAccess({
      groupId: options.parentId,
      scope: options.scope,
      projectId: options.projectId,
      userId: options.userId,
    });

    if (options.childGroupType) {
      const parentGroupType = this.resolveGroupType(parent as any);
      if (parentGroupType !== options.childGroupType) {
        throw new BadRequestException('Cannot mix group types in one hierarchy');
      }
    }

    return parent.id;
  }

  public async ensureNoCycle(options: { collectionId: string; parentId: string }) {
    const [res] = (await this.prisma.$queryRaw<Array<{ has_target: boolean; has_cycle: boolean }>>`
      WITH RECURSIVE parents AS (
        SELECT
          id,
          parent_id,
          ARRAY[id] AS path,
          FALSE AS cycle
        FROM content_collections
        WHERE id = ${options.parentId}::uuid

        UNION ALL

        SELECT
          c.id,
          c.parent_id,
          p.path || c.id,
          c.id = ANY(p.path) AS cycle
        FROM content_collections c
        JOIN parents p ON c.id = p.parent_id
        WHERE p.cycle = FALSE
      )
      SELECT
        EXISTS(SELECT 1 FROM parents WHERE id = ${options.collectionId}::uuid) AS has_target,
        EXISTS(SELECT 1 FROM parents WHERE cycle = TRUE) AS has_cycle
    `) as Array<{ has_target: boolean; has_cycle: boolean }>;

    if (res?.has_cycle) {
      throw new BadRequestException('Invalid group hierarchy');
    }

    if (res?.has_target) {
      throw new BadRequestException('Cannot move group into its descendant');
    }
  }

  public async listCollections(
    query: {
      scope: 'personal' | 'project';
      projectId?: string;
    },
    userId: string,
  ) {
    if (query.scope === 'project') {
      if (!query.projectId) {
        throw new BadRequestException('projectId is required for project scope');
      }
      await this.permissions.checkProjectAccess(query.projectId, userId, true);
    }

    const where: any =
      query.scope === 'personal'
        ? { userId, projectId: null }
        : {
            projectId: query.projectId,
            OR: [
              {
                type: 'GROUP',
                OR: [{ groupType: 'PROJECT_SHARED' }, { groupType: 'PROJECT_USER', userId }],
              },
              { type: 'SAVED_VIEW', userId },
            ],
          };

    const collections = await this.prisma.contentCollection.findMany({
      where,
      include: {
        _count: {
          select: {
            contentItemGroups: {
              where: {
                contentItem: { archivedAt: null },
              },
            },
          },
        },
      },
      orderBy: { order: 'asc' },
    });

    return collections.map(collection => {
      const visibility =
        query.scope === 'personal'
          ? 'PERSONAL'
          : collection.type === 'SAVED_VIEW'
            ? 'PROJECT_PRIVATE'
            : this.resolveGroupType(collection as any) === 'PROJECT_SHARED'
              ? 'PROJECT_SHARED'
              : 'PROJECT_PRIVATE';

      if (collection.type !== 'GROUP') {
        return {
          ...collection,
          visibility,
        };
      }

      return {
        ...collection,
        directItemsCount: (collection as any)._count?.contentItemGroups ?? 0,
        visibility,
      };
    });
  }

  public async createCollection(
    dto: {
      scope: 'personal' | 'project';
      projectId?: string;
      type: 'GROUP' | 'SAVED_VIEW';
      groupType?: 'PERSONAL_USER' | 'PROJECT_USER' | 'PROJECT_SHARED';
      parentId?: string;
      title: string;
      config?: unknown;
    },
    userId: string,
  ) {
    if (dto.scope === 'project') {
      if (!dto.projectId) {
        throw new BadRequestException('projectId is required for project scope');
      }
      await this.permissions.checkProjectAccess(dto.projectId, userId, true);
      await this.assertNotViewer(dto.projectId, userId);
    }

    if (dto.type === 'GROUP') {
      if (dto.scope === 'personal') {
        if (dto.groupType && dto.groupType !== 'PERSONAL_USER') {
          throw new BadRequestException('Invalid groupType for personal scope');
        }
      } else {
        if (!dto.groupType) {
          throw new BadRequestException(
            'groupType is required for GROUP collections in project scope',
          );
        }
        if (dto.groupType === 'PROJECT_SHARED') {
          await this.assertProjectOwnerOrAdmin(dto.projectId!, userId);
        }
      }
    } else {
      if (dto.groupType) {
        throw new BadRequestException('groupType is only allowed for GROUP collections');
      }
    }

    const scopeWhere: any =
      dto.scope === 'personal'
        ? { userId, projectId: null }
        : {
            projectId: dto.projectId,
            OR: [
              {
                type: 'GROUP',
                OR: [{ groupType: 'PROJECT_SHARED' }, { groupType: 'PROJECT_USER', userId }],
              },
              { type: 'SAVED_VIEW', userId },
            ],
          };

    if (dto.type !== 'GROUP' && dto.parentId) {
      throw new BadRequestException('Only groups can have parent groups');
    }

    const resolvedChildGroupType: 'PERSONAL_USER' | 'PROJECT_USER' | 'PROJECT_SHARED' | undefined =
      dto.type === 'GROUP'
        ? dto.scope === 'personal'
          ? 'PERSONAL_USER'
          : dto.groupType
        : undefined;

    const parentId =
      dto.type === 'GROUP'
        ? await this.resolveParentGroupId({
            parentId: dto.parentId,
            scope: dto.scope,
            projectId: dto.projectId,
            userId,
            childGroupType: resolvedChildGroupType,
          })
        : null;

    return this.withSerializableRetry('createCollection', () =>
      this.prisma.$transaction(
        async tx => {
          const maxOrder = await tx.contentCollection.aggregate({
            where: scopeWhere,
            _max: { order: true },
          });

          const nextOrder = (maxOrder?._max?.order ?? -1) + 1;

          return (tx.contentCollection as any).create({
            data: {
              type: dto.type,
              title: dto.title,
              groupType: dto.type === 'GROUP' ? (resolvedChildGroupType as any) : null,
              userId:
                dto.scope === 'personal'
                  ? userId
                  : dto.type === 'SAVED_VIEW'
                    ? userId
                    : resolvedChildGroupType === 'PROJECT_SHARED'
                      ? null
                      : userId,
              projectId: dto.scope === 'project' ? dto.projectId! : null,
              parentId,
              order: nextOrder,
              config: (dto.config ?? {}) as any,
            },
          });
        },
        { isolationLevel: 'Serializable' },
      ),
    );
  }

  public async updateCollection(
    collectionId: string,
    dto: {
      scope: 'personal' | 'project';
      projectId?: string;
      parentId?: string | null;
      title?: string;
      config?: unknown;
    },
    userId: string,
  ) {
    const collection = await this.assertCollectionAccess({
      collectionId,
      scope: dto.scope,
      projectId: dto.projectId,
      userId,
      requireMutationPermission: true,
    });

    if ((collection.type as any) !== 'GROUP' && dto.parentId !== undefined) {
      throw new BadRequestException('Only groups can have parent groups');
    }

    const childGroupType =
      (collection.type as any) === 'GROUP' ? this.resolveGroupType(collection as any) : undefined;

    const parentId = await this.resolveParentGroupId({
      parentId: dto.parentId,
      scope: dto.scope,
      projectId: dto.projectId,
      userId,
      childGroupType,
    });

    if (parentId === collection.id) {
      throw new BadRequestException('Group cannot be parent of itself');
    }
    if (parentId) {
      await this.ensureNoCycle({ collectionId, parentId });
    }

    return (this.prisma.contentCollection as any).update({
      where: { id: collection.id },
      data: {
        parentId,
        title: dto.title,
        config: dto.config as any,
      },
    });
  }

  public async deleteCollection(
    collectionId: string,
    options: { scope: 'personal' | 'project'; projectId?: string },
    userId: string,
  ) {
    const collection = await this.assertCollectionAccess({
      collectionId,
      scope: options.scope,
      projectId: options.projectId,
      userId,
      requireMutationPermission: true,
    });

    if ((collection.type as any) !== 'GROUP') {
      return this.prisma.contentCollection.delete({ where: { id: collectionId } });
    }

    return this.prisma.$transaction(async tx => {
      // Subgroup deletion: keep descendants, move their parent to the level above.
      // Also move direct item-group links to the parent group (or orphan if parent is missing).
      if (collection.parentId) {
        const parentId = collection.parentId;

        await tx.$executeRaw`
          UPDATE content_item_groups AS g
          SET collection_id = ${parentId}
          WHERE g.collection_id = ${collectionId}
            AND NOT EXISTS (
              SELECT 1
              FROM content_item_groups AS g2
              WHERE g2.content_item_id = g.content_item_id
                AND g2.collection_id = ${parentId}
            )
        `;

        await tx.contentItemGroup.deleteMany({ where: { collectionId } });

        await tx.contentCollection.updateMany({
          where: { parentId: collectionId },
          data: { parentId },
        });

        return tx.contentCollection.delete({ where: { id: collectionId } });
      }

      // Root group deletion: delete the whole subtree and orphan items by removing links.
      await tx.$executeRaw`
        WITH RECURSIVE children AS (
          SELECT id FROM content_collections WHERE id = ${collectionId}
          UNION ALL
          SELECT c.id FROM content_collections c JOIN children p ON c.parent_id = p.id
        )
        DELETE FROM content_item_groups WHERE collection_id IN (SELECT id FROM children)
      `;

      return tx.$executeRaw`
        WITH RECURSIVE children AS (
          SELECT id FROM content_collections WHERE id = ${collectionId}
          UNION ALL
          SELECT c.id FROM content_collections c JOIN children p ON c.parent_id = p.id
        )
        DELETE FROM content_collections WHERE id IN (SELECT id FROM children)
      `;
    });
  }

  public async reorderCollections(
    dto: { scope: 'personal' | 'project'; projectId?: string; ids: string[] },
    userId: string,
  ) {
    if (dto.scope === 'project') {
      if (!dto.projectId) {
        throw new BadRequestException('projectId is required for project scope');
      }
      await this.permissions.checkProjectAccess(dto.projectId, userId, true);
      await this.assertNotViewer(dto.projectId, userId);
    }

    const where: any =
      dto.scope === 'personal'
        ? { userId, projectId: null }
        : {
            projectId: dto.projectId,
            OR: [
              {
                type: 'GROUP',
                OR: [{ groupType: 'PROJECT_SHARED' }, { groupType: 'PROJECT_USER', userId }],
              },
              { type: 'SAVED_VIEW', userId },
            ],
          };

    const existing = await this.prisma.contentCollection.findMany({
      where,
      select: { id: true },
    });

    const existingIds = new Set(existing.map((t: any) => t.id));
    for (const id of dto.ids) {
      if (!existingIds.has(id)) {
        throw new BadRequestException('Collection list contains invalid id');
      }
    }

    await this.prisma.$transaction(
      dto.ids.map((id, idx) =>
        this.prisma.contentCollection.update({
          where: { id },
          data: { order: idx },
        }),
      ),
    );

    return { ok: true };
  }
}
