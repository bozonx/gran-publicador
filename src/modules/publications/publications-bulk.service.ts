import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PostStatus, PublicationStatus } from '../../generated/prisma/index.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PermissionsService } from '../../common/services/permissions.service.js';
import { PermissionKey } from '../../common/types/permissions.types.js';
import { BulkOperationDto } from './dto/bulk-operation.dto.js';

@Injectable()
export class PublicationsBulkService {
  private readonly logger = new Logger(PublicationsBulkService.name);

  constructor(
    private prisma: PrismaService,
    private permissions: PermissionsService,
  ) {}

  public async bulkOperation(
    userId: string,
    dto: BulkOperationDto,
    refreshEffectiveAt: (id: string) => Promise<void>,
  ) {
    const { ids, operation, status } = dto;

    if (!ids || ids.length === 0) {
      return { count: 0 };
    }

    const publications = await this.prisma.publication.findMany({
      where: { id: { in: ids } },
      select: { id: true, projectId: true, createdBy: true },
    });

    const authorizedIds: string[] = [];

    for (const pub of publications) {
      try {
        if (pub.createdBy !== userId) {
          await this.permissions.checkProjectPermission(pub.projectId, userId, ['ADMIN']);
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

        if (status === PublicationStatus.DRAFT || status === PublicationStatus.READY) {
          await this.prisma.post.updateMany({
            where: { publicationId: { in: authorizedIds } },
            data: {
              status: PostStatus.PENDING,
              scheduledAt: null,
              errorMessage: null,
              publishedAt: null,
            },
          });

          const result = await this.prisma.publication.updateMany({
            where: { id: { in: authorizedIds } },
            data: { status, scheduledAt: null },
          });

          await Promise.all(authorizedIds.map(id => refreshEffectiveAt(id)));

          return result;
        }

        return this.prisma.publication.updateMany({
          where: { id: { in: authorizedIds } },
          data: { status },
        });

      case 'MOVE': {
        if (!dto.targetProjectId) {
          throw new BadRequestException('targetProjectId is required for MOVE operation');
        }

        await this.permissions.checkPermission(
          dto.targetProjectId,
          userId,
          PermissionKey.PUBLICATIONS_CREATE,
        );

        await this.prisma.post.deleteMany({
          where: { publicationId: { in: authorizedIds } },
        });

        await this.prisma.publicationRelationItem.deleteMany({
          where: { publicationId: { in: authorizedIds } },
        });

        const moveResult = await this.prisma.publication.updateMany({
          where: { id: { in: authorizedIds } },
          data: {
            projectId: dto.targetProjectId,
            status: PublicationStatus.DRAFT,
            scheduledAt: null,
          },
        });

        await Promise.all(authorizedIds.map(id => refreshEffectiveAt(id)));

        return moveResult;
      }

      default:
        throw new BadRequestException(`Unsupported operation: ${operation}`);
    }
  }
}
