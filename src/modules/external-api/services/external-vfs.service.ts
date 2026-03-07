import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MediaService } from '../../media/media.service.js';
import { MediaType, StorageType, ContentCollectionType } from '../../../generated/prisma/index.js';

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
      // List Root Collections (Folders)
      const where: any = {
        parentId: null,
        type: ContentCollectionType.GROUP,
        OR: [{ userId }, { project: { members: { some: { userId } } } }],
      };

      if (!allProjects && projectIds.length > 0) {
        where.projectId = { in: projectIds };
      }

      const collections = await this.prisma.contentCollection.findMany({
        where,
        orderBy: { title: 'asc' },
        include: {
          _count: {
            select: {
              items: true,
              children: true,
            },
          },
        },
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
          itemsCount: (c._count?.items || 0) + (c._count?.children || 0),
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

    // 1. Get subcollections
    const subcollections = await this.prisma.contentCollection.findMany({
      where: {
        parentId: collection.id,
        type: ContentCollectionType.GROUP,
      },
      orderBy: { title: 'asc' },
      include: {
        _count: {
          select: {
            items: true,
            children: true,
          },
        },
      },
    });

    // 2. Get items (files)
    const items = await this.prisma.contentItem.findMany({
      where: { collectionItems: { some: { collectionId: collection.id } } },
      include: {
        media: {
          include: { media: true },
          orderBy: { order: 'asc' },
        },
        tagObjects: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const directoryItems = [
      ...subcollections.map(c => ({
        id: c.id,
        name: c.title,
        type: 'directory',
        path: `/${c.id}`,
        itemsCount: (c._count?.items || 0) + (c._count?.children || 0),
      })),
      ...items.map(item => ({
        id: item.id,
        name: item.title || 'Untitled',
        type: 'file',
        path: `/${collection.id}/${item.id}`,
        text: item.text,
        language: item.language,
        tags: item.tagObjects.map(t => t.name),
        meta: item.meta,
        media: item.media.map(m => ({
          id: m.media.id,
          type: m.media.type,
          url:
            m.media.storageType === StorageType.STORAGE
              ? `/api/v1/media/${m.media.id}/file?download=1`
              : m.media.storagePath,
          mimeType: m.media.mimeType,
          size: m.media.sizeBytes ? Number(m.media.sizeBytes) : 0,
          meta: m.media.meta,
        })),
      })),
    ];

    return {
      type: 'directory',
      items: directoryItems,
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
    type?: string,
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

    if (type) {
      if (type === 'text') {
        where.AND.push({
          OR: [
            { text: { not: null } },
            { media: { some: { media: { type: MediaType.DOCUMENT } } } },
          ],
        });
      } else {
        const mediaTypeMap: Record<string, MediaType> = {
          video: MediaType.VIDEO,
          audio: MediaType.AUDIO,
          image: MediaType.IMAGE,
          document: MediaType.DOCUMENT,
        };
        const prismaMediaType = mediaTypeMap[type];
        if (prismaMediaType) {
          where.AND.push({
            media: { some: { media: { type: prismaMediaType } } },
          });
        }
      }
    }

    const items = await this.prisma.contentItem.findMany({
      where,
      include: {
        media: {
          include: { media: true },
          orderBy: { order: 'asc' },
        },
        tagObjects: { select: { name: true } },
      },
      take: limit,
      skip: offset,
    });

    return items.map(item => ({
      id: item.id,
      name: item.title || 'Untitled',
      type: 'file',
      text: item.text,
      language: item.language,
      tags: item.tagObjects.map(t => t.name),
      meta: item.meta,
      media: item.media.map(m => ({
        id: m.media.id,
        type: m.media.type,
        url:
          m.media.storageType === StorageType.STORAGE
            ? `/api/v1/media/${m.media.id}/file?download=1`
            : m.media.storagePath,
        mimeType: m.media.mimeType,
        meta: m.media.meta,
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
