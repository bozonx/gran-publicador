import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MediaService } from '../../media/media.service.js';
import { ContentItemsService } from '../../content-library/content-items.service.js';
import { ContentCollectionsService } from '../../content-library/content-collections.service.js';
import {
  MediaType,
  StorageType,
  ContentCollectionType,
  ContentCollectionGroupType,
} from '../../../generated/prisma/index.js';

@Injectable()
export class ExternalVfsService {
  private readonly logger = new Logger(ExternalVfsService.name);
  private readonly VIRTUAL_ALL_ID = 'virtual-all';

  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
    private readonly itemsService: ContentItemsService,
    private readonly collectionsService: ContentCollectionsService,
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
      // List Root Collections (Folders) + Virtual "All"
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
      });

      // Count orphans for "All" folder
      const orphansWhere: any = {
        archivedAt: null,
        collectionItems: { none: {} },
        OR: [{ userId }, { project: { members: { some: { userId } } } }],
      };
      if (!allProjects && projectIds.length > 0) {
        orphansWhere.projectId = { in: projectIds };
      }
      const orphansCount = await this.prisma.contentItem.count({ where: orphansWhere });

      const items = [
        {
          id: this.VIRTUAL_ALL_ID,
          name: 'All',
          type: 'directory',
          path: `/${this.VIRTUAL_ALL_ID}`,
          itemsCount: orphansCount,
        },
        ...collections.map(c => ({
          id: c.id,
          name: c.title,
          type: 'directory',
          path: `/${c.id}`,
          itemsCount: (c._count?.items || 0) + (c._count?.children || 0),
        })),
      ];

      return {
        type: 'directory',
        items: items.slice(offset, offset + limit),
      };
    }

    if (path === `/${this.VIRTUAL_ALL_ID}` || path === this.VIRTUAL_ALL_ID) {
      // List Orphans
      const where: any = {
        archivedAt: null,
        collectionItems: { none: {} },
        OR: [{ userId }, { project: { members: { some: { userId } } } }],
      };

      if (!allProjects && projectIds.length > 0) {
        where.projectId = { in: projectIds };
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
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      });

      return {
        type: 'directory',
        items: items.map(item => this.mapFileItem(item, this.VIRTUAL_ALL_ID)),
      };
    }

    // List Items in Physical Collection
    const collectionId = path.startsWith('/') ? path.substring(1) : path;

    // Check access to collection
    const collection = await this.prisma.contentCollection.findFirst({
      where: {
        id: collectionId,
        OR: [{ userId }, { project: { members: { some: { userId } } } }],
      },
    });

    if (!collection) {
      throw new NotFoundException('Directory not found or access denied');
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
      where: {
        collectionItems: { some: { collectionId: collection.id } },
        archivedAt: null,
      },
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
      ...items.map(item => this.mapFileItem(item, collection.id)),
    ];

    return {
      type: 'directory',
      items: directoryItems,
    };
  }

  async getThumbnail(
    mediaId: string,
    width: number,
    height: number,
    quality: number | undefined,
    userId: string,
    fit?: string,
  ) {
    // Media access check is performed by mediaService inside getMediaThumbnail
    return this.mediaService.getMediaThumbnail(
      mediaId,
      width,
      height,
      quality,
      userId,
      fit,
    );
  }

  async getFile(
    mediaId: string,
    userId: string,
    range?: string,
    download?: boolean,
  ) {
    return this.mediaService.getMediaFile(mediaId, userId, range, download);
  }

  private mapFileItem(item: any, parentCollectionId: string) {
    return {
      id: item.id,
      name: item.title || 'Untitled',
      type: 'file',
      path: `/${parentCollectionId}/${item.id}`,
      text: item.text,
      language: item.language,
      tags: item.tagObjects.map((t: any) => t.name),
      meta: item.meta,
      media: item.media.map((m: any) => {
        const isStorage = m.media.storageType === StorageType.STORAGE;
        const signature = isStorage ? this.mediaService.generatePublicToken(m.media.id) : '';
        
        return {
          id: m.media.id,
          type: m.media.type,
          url: isStorage
            ? `/api/v1/media/p/${m.media.id}/${signature}?download=1`
            : m.media.storagePath,
          thumbnailUrl: isStorage
            ? `/api/v1/media/p/${m.media.id}/${signature}/thumbnail?w=400&h=400`
            : m.media.storagePath,
          mimeType: m.media.mimeType,
          size: m.media.sizeBytes ? Number(m.media.sizeBytes) : 0,
          meta: m.media.meta,
        };
      }),
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
      archivedAt: null,
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
      tags: item.tagObjects.map((t: any) => t.name),
      meta: item.meta,
      media: item.media.map((m: any) => {
        const isStorage = m.media.storageType === StorageType.STORAGE;
        const signature = isStorage ? this.mediaService.generatePublicToken(m.media.id) : '';
        
        return {
          id: m.media.id,
          type: m.media.type,
          url: isStorage
            ? `/api/v1/media/p/${m.media.id}/${signature}?download=1`
            : m.media.storagePath,
          thumbnailUrl: isStorage
            ? `/api/v1/media/p/${m.media.id}/${signature}/thumbnail?w=400&h=400`
            : m.media.storagePath,
          mimeType: m.media.mimeType,
          meta: m.media.meta,
        };
      }),
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
    if (collectionId !== this.VIRTUAL_ALL_ID) {
      const collectionAccessWhere: any = {
        id: collectionId,
        OR: [{ userId }, { project: { members: { some: { userId } } } }],
      };

      if (allProjects === false && projectIds && projectIds.length > 0) {
        collectionAccessWhere.projectId = { in: projectIds };
      }

      const collection = await this.prisma.contentCollection.findFirst({
        where: collectionAccessWhere,
      });

      if (!collection) {
        throw new BadRequestException('Collection not found or access denied');
      }
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

      // Determine project ID if not provided but token is restricted to one project
      let targetProjectId = projectId;
      if (!targetProjectId && projectIds && projectIds.length === 1 && !allProjects) {
        targetProjectId = projectIds[0];
      }

      // Create ContentItem
      const contentItem = await tx.contentItem.create({
        data: {
          userId: targetProjectId ? null : userId,
          projectId: targetProjectId || null,
          title: part.filename,
          collectionItems: collectionId !== this.VIRTUAL_ALL_ID ? {
            create: { collectionId },
          } : undefined,
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

  async createCollection(
    userId: string,
    name: string,
    parentId?: string,
    projectIds?: string[],
    allProjects?: boolean,
  ) {
    // Basic logic: if token is limited to a project, create in that project.
    // If multiple, require explicitly or fail if no single project can be determined.
    let projectId: string | undefined;
    
    if (projectIds && projectIds.length === 1 && !allProjects) {
      projectId = projectIds[0];
    }

    return this.collectionsService.createCollection({
      title: name,
      type: ContentCollectionType.GROUP,
      scope: projectId ? 'project' : 'personal',
      projectId,
      parentId,
      groupType: projectId ? ContentCollectionGroupType.PROJECT_SHARED : ContentCollectionGroupType.PERSONAL_USER,
    }, userId);
  }

  async updateCollection(userId: string, collectionId: string, name: string) {
    // Find collection to determine scope
    const collection = await this.prisma.contentCollection.findUnique({
      where: { id: collectionId },
      select: { projectId: true, userId: true }
    });
    if (!collection) throw new NotFoundException('Collection not found');

    return this.collectionsService.updateCollection(collectionId, {
      title: name,
      scope: collection.projectId ? 'project' : 'personal',
      projectId: collection.projectId || undefined,
    }, userId);
  }

  async deleteCollection(userId: string, collectionId: string) {
    const collection = await this.prisma.contentCollection.findUnique({
      where: { id: collectionId },
      select: { projectId: true, userId: true }
    });
    if (!collection) throw new NotFoundException('Collection not found');

    return this.collectionsService.deleteCollection(collectionId, {
      scope: collection.projectId ? 'project' : 'personal',
      projectId: collection.projectId || undefined,
    }, userId);
  }

  async updateItem(userId: string, itemId: string, name?: string, tags?: string[]) {
    // Use ContentItemsService to handle complexity of tags and permissions
    return this.itemsService.update(itemId, {
      title: name,
      tags
    }, userId);
  }

  async deleteItem(userId: string, itemId: string) {
    // Permanent deletion via ContentItemsService
    return this.itemsService.remove(itemId, userId);
  }
}
