import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MediaService } from '../media/media.service.js';
import { MediaType, StorageType } from '../../generated/prisma/index.js';

@Injectable()
export class ExternalVfsService {
  private readonly logger = new Logger(ExternalVfsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
  ) {}

  async list(
    userId: string,
    path: string = '/',
    projectIds: string[],
    allProjects: boolean,
    limit: number = 50,
    offset: number = 0,
  ) {
    if (path === '/' || !path) {
      // List Collections (Folders)
      const where: any = {
        OR: [{ userId }, { project: { members: { some: { userId } } } }],
      };

      if (!allProjects && projectIds.length > 0) {
        where.projectId = { in: projectIds };
      }

      const collections = await this.prisma.contentCollection.findMany({
        where,
        orderBy: { title: 'asc' },
        take: limit,
        skip: offset,
      });

      return {
        type: 'directory',
        items: collections.map(c => ({
          id: c.id,
          name: c.title,
          type: 'directory',
          path: `/${c.id}`,
        })),
      };
    }

    // List Items in Collection
    const collectionId = path.startsWith('/') ? path.substring(1) : path;

    // Check access to collection
    const collection = await this.prisma.contentCollection.findFirst({
      where: {
        id: collectionId,
        OR: [{ userId }, { project: { members: { some: { userId } } } }],
      },
    });

    if (!collection) {
      return { type: 'directory', items: [] };
    }

    const items = await this.prisma.contentItem.findMany({
      where: { collectionItems: { some: { collectionId: collection.id } } },
      include: {
        media: {
          include: { media: true },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return {
      type: 'directory',
      items: items.map(item => ({
        id: item.id,
        name: item.title || 'Untitled',
        type: 'file',
        path: `/${collection.id}/${item.id}`,
        media: item.media.map(m => ({
          id: m.media.id,
          type: m.media.type,
          url:
            m.media.storageType === StorageType.STORAGE
              ? `/api/v1/media/${m.media.id}/download`
              : m.media.storagePath,
          mimeType: m.media.mimeType,
          size: m.media.sizeBytes ? Number(m.media.sizeBytes) : 0,
        })),
      })),
    };
  }

  async search(
    userId: string,
    query: string,
    tags: string[],
    projectIds: string[],
    allProjects: boolean,
    limit: number = 50,
    offset: number = 0,
  ) {
    const where: any = {
      OR: [{ userId }, { project: { members: { some: { userId } } } }],
      AND: [],
    };

    if (!allProjects && projectIds.length > 0) {
      where.AND.push({
        projectId: { in: projectIds },
      });
    }

    if (query) {
      where.AND.push({
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { text: { contains: query, mode: 'insensitive' } },
        ],
      });
    }

    if (tags && tags.length > 0) {
      where.AND.push({
        tagObjects: {
          some: { name: { in: tags } },
        },
      });
    }

    const items = await this.prisma.contentItem.findMany({
      where,
      include: {
        media: {
          include: { media: true },
          orderBy: { order: 'asc' },
        },
      },
      take: limit,
      skip: offset,
    });

    return items.map(item => ({
      id: item.id,
      name: item.title || 'Untitled',
      type: 'file',
      media: item.media.map(m => ({
        id: m.media.id,
        type: m.media.type,
        url:
          m.media.storageType === StorageType.STORAGE
            ? `/api/v1/media/${m.media.id}/download`
            : m.media.storagePath,
        mimeType: m.media.mimeType,
      })),
    }));
  }

  async upload(
    userId: string,
    part: any,
    collectionId: string,
    projectId?: string,
    projectIds?: string[],
    allProjects?: boolean,
  ) {
    this.logger.log(`Uploading file to VFS: user=${userId}, collection=${collectionId}`);

    // Verify user has access to this collection
    const where: any = {
      id: collectionId,
      OR: [{ userId }, { project: { members: { some: { userId } } } }],
    };

    if (allProjects === false && projectIds && projectIds.length > 0) {
      where.projectId = { in: projectIds };
    }

    const collection = await this.prisma.contentCollection.findFirst({
      where,
    });

    if (!collection) {
      throw new BadRequestException('Collection not found or access denied');
    }

    // 1. Upload file using MediaService (streaming)
    const { fileId, metadata } = await this.mediaService.uploadFileToStorage(
      part.file,
      part.filename,
      part.mimetype,
      undefined, // fileSize
      userId,
      undefined, // collection
      undefined, // optimize
    );

    // 2. Create Media record and ContentItem in transaction
    return await this.prisma.$transaction(async tx => {
      // Create Media
      const media = await tx.media.create({
        data: {
          type: part.mimetype?.startsWith('video/') ? MediaType.VIDEO : MediaType.IMAGE,
          storageType: StorageType.STORAGE,
          storagePath: fileId,
          filename: part.filename,
          mimeType: part.mimetype,
          sizeBytes: metadata.size,
          meta: metadata as any,
        },
      });

      // Create ContentItem
      const contentItem = await tx.contentItem.create({
        data: {
          userId,
          projectId,
          title: part.filename,
          collectionItems: {
            create: { collectionId },
          },
          media: {
            create: {
              mediaId: media.id,
              order: 0,
            },
          },
        },
      });

      return {
        id: contentItem.id,
        name: contentItem.title,
        type: 'file',
        mediaId: media.id,
      };
    });
  }
}
