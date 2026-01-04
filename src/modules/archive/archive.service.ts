import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Project, Channel, Publication, Post } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ArchiveEntityType, ArchiveStatsDto } from './dto/archive.dto.js';

type ArchivableEntity = Project | Channel | Publication;

import { PermissionsService } from '../../common/services/permissions.service.js';

@Injectable()
export class ArchiveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) { }

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
        await this.permissions.checkProjectPermission(id, userId, ['OWNER', 'ADMIN']);
        return this.prisma.project.update({ where: { id }, data });
      }
      case ArchiveEntityType.CHANNEL: {
        const channel = await this.prisma.channel.findUnique({ where: { id } });
        if (!channel) throw new NotFoundException('Channel not found');
        await this.permissions.checkProjectPermission(channel.projectId, userId, ['OWNER', 'ADMIN', 'EDITOR']);
        return this.prisma.channel.update({ where: { id }, data });
      }
      case ArchiveEntityType.PUBLICATION: {
        const publication = await this.prisma.publication.findUnique({ where: { id } });
        if (!publication) throw new NotFoundException('Publication not found');
        // Author or Admin/Owner
        if (publication.createdBy !== userId) {
          await this.permissions.checkProjectPermission(publication.projectId, userId, ['OWNER', 'ADMIN']);
        }
        return this.prisma.publication.update({ where: { id }, data });
      }
      default: {
        throw new BadRequestException('Invalid entity type');
      }
    }
  }

  public async restoreEntity(type: ArchiveEntityType, id: string, userId: string): Promise<ArchivableEntity> {
    const data = {
      archivedAt: null,
      archivedBy: null,
    };

    switch (type) {
      case ArchiveEntityType.PROJECT: {
        await this.permissions.checkProjectPermission(id, userId, ['OWNER', 'ADMIN']);
        return this.prisma.project.update({ where: { id }, data });
      }
      case ArchiveEntityType.CHANNEL: {
        const channel = await this.prisma.channel.findUnique({ where: { id } });
        if (!channel) throw new NotFoundException('Channel not found');
        await this.permissions.checkProjectPermission(channel.projectId, userId, ['OWNER', 'ADMIN', 'EDITOR']);
        return this.prisma.channel.update({ where: { id }, data });
      }
      case ArchiveEntityType.PUBLICATION: {
        const publication = await this.prisma.publication.findUnique({ where: { id } });
        if (!publication) throw new NotFoundException('Publication not found');
        if (publication.createdBy !== userId) {
          await this.permissions.checkProjectPermission(publication.projectId, userId, ['OWNER', 'ADMIN']);
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
    userId: string
  ): Promise<ArchivableEntity> {
    switch (type) {
      case ArchiveEntityType.PROJECT: {
        await this.permissions.checkProjectPermission(id, userId, ['OWNER']);
        return this.prisma.project.delete({ where: { id } });
      }
      case ArchiveEntityType.CHANNEL: {
        const channel = await this.prisma.channel.findUnique({ where: { id } });
        if (!channel) throw new NotFoundException('Channel not found');
        await this.permissions.checkProjectPermission(channel.projectId, userId, ['OWNER', 'ADMIN']);
        return this.prisma.channel.delete({ where: { id } });
      }
      case ArchiveEntityType.PUBLICATION: {
        const publication = await this.prisma.publication.findUnique({ where: { id } });
        if (!publication) throw new NotFoundException('Publication not found');
        if (publication.createdBy !== userId) {
          await this.permissions.checkProjectPermission(publication.projectId, userId, ['OWNER', 'ADMIN']);
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
  ): Promise<Channel | Post | Publication> {
    switch (type) {
      case ArchiveEntityType.CHANNEL: {
        // Move channel to another project
        return this.prisma.channel.update({
          where: { id },
          data: { projectId: targetParentId },
        });
      }

      case ArchiveEntityType.PUBLICATION: {
        // Move publication to another project
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

  public async isEntityArchived(type: ArchiveEntityType, id: string): Promise<boolean> {
    switch (type) {
      case ArchiveEntityType.CHANNEL: {
        const channel = await this.prisma.channel.findUnique({
          where: { id },
          include: { project: true },
        });
        if (!channel) {
          return false;
        }
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
        return !!(publication.archivedAt ?? publication.project.archivedAt);
      }

      case ArchiveEntityType.PROJECT: {
        const project = await this.prisma.project.findUnique({ where: { id } });
        return !!project?.archivedAt;
      }

      default: {
        return false;
      }
    }
  }

  public async getArchiveStats(): Promise<ArchiveStatsDto> {
    const [projects, channels, publications] = await Promise.all([
      this.prisma.project.count({ where: { archivedAt: { not: null } } }),
      this.prisma.channel.count({ where: { archivedAt: { not: null } } }),
      this.prisma.publication.count({ where: { archivedAt: { not: null } } }),
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
  ): Promise<Project[] | Channel[] | Publication[] | Post[]> {
    switch (type) {
      case ArchiveEntityType.PROJECT: {
        return this.prisma.project.findMany({ where: { archivedAt: { not: null } } });
      }
      case ArchiveEntityType.CHANNEL: {
        return this.prisma.channel.findMany({ where: { archivedAt: { not: null } } });
      }
      case ArchiveEntityType.PUBLICATION: {
        return this.prisma.publication.findMany({ where: { archivedAt: { not: null } } });
      }
      default: {
        throw new BadRequestException('Invalid entity type');
      }
    }
  }
}
