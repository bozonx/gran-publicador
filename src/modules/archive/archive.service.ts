import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import type { Project, Channel, Publication, Post } from '../../generated/prisma/index.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PermissionsService } from '../../common/services/permissions.service.js';
import { PermissionKey } from '../../common/types/permissions.types.js';
import { ArchiveEntityType, ArchiveStatsDto } from './dto/archive.dto.js';

type ArchivableEntity = Project | Channel | Publication;

@Injectable()
export class ArchiveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  public async archiveEntity(
    type: ArchiveEntityType,
    id: string,
    userId: string,
  ): Promise<ArchivableEntity> {
    const data = {
      archivedAt: new Date(),
      archivedBy: userId,
    };

    switch (type) {
      case ArchiveEntityType.PROJECT: {
        await this.permissions.checkPermission(id, userId, PermissionKey.PROJECT_UPDATE);
        return this.prisma.project.update({ where: { id }, data });
      }
      case ArchiveEntityType.CHANNEL: {
        const channel = await this.prisma.channel.findUnique({ where: { id } });
        if (!channel) throw new NotFoundException('Channel not found');
        await this.permissions.checkPermission(channel.projectId, userId, PermissionKey.CHANNELS_UPDATE);
        return this.prisma.channel.update({ where: { id }, data });
      }
      case ArchiveEntityType.PUBLICATION: {
        const publication = await this.prisma.publication.findUnique({ where: { id } });
        if (!publication) throw new NotFoundException('Publication not found');
        // Author or Admin/Owner
        if (publication.createdBy !== userId) {
          await this.permissions.checkPermission(publication.projectId, userId, PermissionKey.PUBLICATIONS_UPDATE_ALL);
        }
        return this.prisma.publication.update({ where: { id }, data });
      }
      default: {
        throw new BadRequestException('Invalid entity type');
      }
    }
  }

  public async restoreEntity(
    type: ArchiveEntityType,
    id: string,
    userId: string,
  ): Promise<ArchivableEntity> {
    const data = {
      archivedAt: null,
      archivedBy: null,
    };

    switch (type) {
      case ArchiveEntityType.PROJECT: {
        await this.permissions.checkPermission(id, userId, PermissionKey.PROJECT_UPDATE);
        return this.prisma.project.update({ where: { id }, data });
      }
      case ArchiveEntityType.CHANNEL: {
        const channel = await this.prisma.channel.findUnique({ where: { id } });
        if (!channel) throw new NotFoundException('Channel not found');
        await this.permissions.checkPermission(channel.projectId, userId, PermissionKey.CHANNELS_UPDATE);
        return this.prisma.channel.update({ where: { id }, data });
      }
      case ArchiveEntityType.PUBLICATION: {
        const publication = await this.prisma.publication.findUnique({ where: { id } });
        if (!publication) throw new NotFoundException('Publication not found');
        if (publication.createdBy !== userId) {
          await this.permissions.checkPermission(publication.projectId, userId, PermissionKey.PUBLICATIONS_UPDATE_ALL);
        }
        return this.prisma.publication.update({ where: { id }, data });
      }
      default: {
        throw new BadRequestException('Invalid entity type');
      }
    }
  }

  public async deleteEntityPermanently(
    type: ArchiveEntityType,
    id: string,
    userId: string,
  ): Promise<ArchivableEntity> {
    switch (type) {
      case ArchiveEntityType.PROJECT: {
        // Only owner can delete project (implicitly checked by checkProjectAccess in PermissionsService)
        await this.permissions.checkProjectAccess(id, userId, false);
        return this.prisma.project.delete({ where: { id } });
      }
      case ArchiveEntityType.CHANNEL: {
        const channel = await this.prisma.channel.findUnique({ where: { id } });
        if (!channel) throw new NotFoundException('Channel not found');
        await this.permissions.checkPermission(channel.projectId, userId, PermissionKey.CHANNELS_DELETE);
        return this.prisma.channel.delete({ where: { id } });
      }
      case ArchiveEntityType.PUBLICATION: {
        const publication = await this.prisma.publication.findUnique({ where: { id } });
        if (!publication) throw new NotFoundException('Publication not found');
        if (publication.createdBy !== userId) {
          await this.permissions.checkPermission(publication.projectId, userId, PermissionKey.PUBLICATIONS_DELETE_ALL);
        }
        return this.prisma.publication.delete({ where: { id } });
      }
      default: {
        throw new BadRequestException('Invalid entity type');
      }
    }
  }

  public async moveEntity(
    type: ArchiveEntityType,
    id: string,
    targetParentId: string,
    userId: string,
  ): Promise<Channel | Post | Publication> {
    switch (type) {
      case ArchiveEntityType.CHANNEL: {
        const channel = await this.prisma.channel.findUnique({ where: { id } });
        if (!channel) throw new NotFoundException('Channel not found');
        // Check source project permissions
        await this.permissions.checkPermission(channel.projectId, userId, PermissionKey.CHANNELS_DELETE);
        // Check target project permissions
        await this.permissions.checkPermission(targetParentId, userId, PermissionKey.CHANNELS_CREATE);

        return this.prisma.channel.update({
          where: { id },
          data: { projectId: targetParentId },
        });
      }

      case ArchiveEntityType.PUBLICATION: {
        const publication = await this.prisma.publication.findUnique({ where: { id } });
        if (!publication) throw new NotFoundException('Publication not found');

        // Check source project permissions (or author)
        if (publication.createdBy !== userId) {
          await this.permissions.checkPermission(publication.projectId, userId, PermissionKey.PUBLICATIONS_DELETE_ALL);
        }

        // Check target project permissions
        await this.permissions.checkPermission(targetParentId, userId, PermissionKey.PUBLICATIONS_CREATE);

        return this.prisma.publication.update({
          where: { id },
          data: { projectId: targetParentId },
        });
      }

      default: {
        throw new BadRequestException('Moving not supported for this entity type');
      }
    }
  }

  public async isEntityArchived(
    type: ArchiveEntityType,
    id: string,
    userId: string,
  ): Promise<boolean> {
    switch (type) {
      case ArchiveEntityType.CHANNEL: {
        const channel = await this.prisma.channel.findUnique({
          where: { id },
          include: { project: true },
        });
        if (!channel) {
          return false;
        }
        await this.permissions.checkProjectAccess(channel.projectId, userId, true);
        return !!(channel.archivedAt ?? channel.project.archivedAt);
      }

      case ArchiveEntityType.PUBLICATION: {
        const publication = await this.prisma.publication.findUnique({
          where: { id },
          include: { project: true },
        });
        if (!publication) {
          return false;
        }

        if (publication.projectId) {
          await this.permissions.checkProjectAccess(publication.projectId, userId, true);
        }

        return !!(publication.archivedAt ?? publication.project?.archivedAt);
      }

      case ArchiveEntityType.PROJECT: {
        const project = await this.prisma.project.findUnique({ where: { id } });
        if (!project) {
          return false;
        }
        await this.permissions.checkProjectAccess(id, userId, true);
        return !!project.archivedAt;
      }

      default: {
        return false;
      }
    }
  }

  public async getArchiveStats(userId: string): Promise<ArchiveStatsDto> {
    // Get project IDs accessible to the user
    const userProjects = await this.prisma.project.findMany({
      where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
      select: { id: true },
    });
    const projectIds = userProjects.map(p => p.id);

    const [projects, channels, publications] = await Promise.all([
      // Only projects owned by user
      this.prisma.project.count({
        where: { archivedAt: { not: null }, ownerId: userId },
      }),
      // Channels in user projects
      this.prisma.channel.count({
        where: { archivedAt: { not: null }, projectId: { in: projectIds } },
      }),
      // Publications in user projects or personal drafts
      this.prisma.publication.count({
        where: {
          archivedAt: { not: null },
          projectId: { in: projectIds },
        },
      }),
    ]);

    return {
      projects,
      channels,
      publications,
      posts: 0,
      total: projects + channels + publications,
    };
  }

  public async getArchivedEntities(
    type: ArchiveEntityType,
    userId: string,
  ): Promise<Project[] | Channel[] | Publication[] | Post[]> {
    const userProjects = await this.prisma.project.findMany({
      where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
      select: { id: true },
    });
    const projectIds = userProjects.map(p => p.id);

    switch (type) {
      case ArchiveEntityType.PROJECT: {
        return this.prisma.project.findMany({
          where: { archivedAt: { not: null }, ownerId: userId },
        });
      }
      case ArchiveEntityType.CHANNEL: {
        return this.prisma.channel.findMany({
          where: { archivedAt: { not: null }, projectId: { in: projectIds } },
        });
      }
      case ArchiveEntityType.PUBLICATION: {
        return this.prisma.publication.findMany({
          where: {
            archivedAt: { not: null },
            projectId: { in: projectIds },
          },
        });
      }
      default: {
        throw new BadRequestException('Invalid entity type');
      }
    }
  }
}
