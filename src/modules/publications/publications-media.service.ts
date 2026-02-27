import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MediaType, Prisma, PublicationStatus, StorageType } from '../../generated/prisma/index.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PermissionsService } from '../../common/services/permissions.service.js';
import { MediaService } from '../media/media.service.js';
import { PermissionKey } from '../../common/types/permissions.types.js';
import { CreatePublicationDto, PublicationMediaInputDto } from './dto/index.js';
import { PostSnapshotBuilderService } from '../social-posting/post-snapshot-builder.service.js';

@Injectable()
export class PublicationsMediaService {
  private readonly logger = new Logger(PublicationsMediaService.name);

  constructor(
    private prisma: PrismaService,
    private permissions: PermissionsService,
    private mediaService: MediaService,
    private snapshotBuilder: PostSnapshotBuilderService,
  ) {}

  public async addMedia(publicationId: string, userId: string, media: any[]) {
    const publication = await this.prisma.publication.findUnique({
      where: { id: publicationId },
      select: { id: true, projectId: true, createdBy: true, status: true },
    });

    if (!publication) {
      throw new NotFoundException('Publication not found');
    }

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

    const existingMedia = await this.prisma.publicationMedia.findMany({
      where: { publicationId },
      orderBy: { order: 'desc' },
      take: 1,
    });

    const startOrder = existingMedia.length > 0 ? existingMedia[0].order + 1 : 0;

    await this.prisma.$transaction(async tx => {
      for (let i = 0; i < media.length; i++) {
        const m = media[i];
        const input = this.getMediaInput(m);
        let mediaId = input.id;
        const hasSpoiler = input.hasSpoiler;

        if (!mediaId) {
          const mediaItem = await tx.media.create({
            data: {
              type: m.type,
              storageType: m.storageType,
              storagePath: m.storagePath,
              filename: m.filename,
              mimeType: m.mimeType,
              sizeBytes: m.sizeBytes,
              meta: m.meta || {},
            },
          });
          mediaId = mediaItem.id;
        }

        await tx.publicationMedia.create({
          data: {
            publicationId,
            mediaId,
            order: startOrder + i,
            hasSpoiler,
          },
        });
      }
    });

    this.logger.log(`Added ${media.length} media items to publication ${publicationId}`);

    // Build snapshot for ready/scheduled publications
    if (
      publication.status === PublicationStatus.READY ||
      publication.status === PublicationStatus.SCHEDULED
    ) {
      await this.snapshotBuilder.buildForPublication(publicationId);
    }

    // Set desync flag for published/failed publications
    if (['PUBLISHED', 'PARTIAL', 'FAILED'].includes(publication.status)) {
      const currentMeta = (publication as any).meta || {};
      if (!currentMeta.isDesynced) {
        await this.prisma.publication.update({
          where: { id: publicationId },
          data: { meta: { ...currentMeta, isDesynced: true } },
        });
      }
    }
  }

  public async removeMedia(publicationId: string, userId: string, mediaId: string) {
    const publication = await this.prisma.publication.findUnique({
      where: { id: publicationId },
      select: { id: true, projectId: true, createdBy: true, status: true },
    });

    if (!publication) {
      throw new NotFoundException('Publication not found');
    }

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

    const pubMedia = await this.prisma.publicationMedia.findFirst({
      where: { publicationId, mediaId },
    });

    if (!pubMedia) {
      throw new NotFoundException('Media not found in this publication');
    }

    await this.prisma.publicationMedia.delete({
      where: { id: pubMedia.id },
    });

    // Check if media is orphaned and cleanup if so
    await this.mediaService.removeIfOrphaned(mediaId);

    // Build snapshot for ready/scheduled publications
    if (
      publication.status === PublicationStatus.READY ||
      publication.status === PublicationStatus.SCHEDULED
    ) {
      await this.snapshotBuilder.buildForPublication(publicationId);
    }

    // Set desync flag for published/failed publications
    if (['PUBLISHED', 'PARTIAL', 'FAILED'].includes(publication.status)) {
      const currentMeta = (publication as any).meta || {};
      if (!currentMeta.isDesynced) {
        await this.prisma.publication.update({
          where: { id: publicationId },
          data: { meta: { ...currentMeta, isDesynced: true } },
        });
      }
    }

    return { success: true };
  }

  public async reorderMedia(
    publicationId: string,
    userId: string,
    mediaOrder: Array<{ id: string; order: number }>,
  ) {
    const publication = await this.prisma.publication.findUnique({
      where: { id: publicationId },
      select: { id: true, projectId: true, createdBy: true, status: true },
    });

    if (!publication) {
      throw new NotFoundException('Publication not found');
    }

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

    await this.prisma.$transaction(
      mediaOrder.map(({ id, order }) =>
        this.prisma.publicationMedia.updateMany({
          where: { publicationId, id },
          data: { order },
        }),
      ),
    );

    this.logger.log(`Reordered ${mediaOrder.length} media items in publication ${publicationId}`);

    // Build snapshot for ready/scheduled publications
    if (
      publication.status === PublicationStatus.READY ||
      publication.status === PublicationStatus.SCHEDULED
    ) {
      await this.snapshotBuilder.buildForPublication(publicationId);
    }

    // Set desync flag for published/failed publications
    if (['PUBLISHED', 'PARTIAL', 'FAILED'].includes(publication.status)) {
      const currentMeta = (publication as any).meta || {};
      if (!currentMeta.isDesynced) {
        await this.prisma.publication.update({
          where: { id: publicationId },
          data: { meta: { ...currentMeta, isDesynced: true } },
        });
      }
    }

    return { success: true };
  }

  public async updateMediaLink(
    publicationId: string,
    userId: string,
    mediaLinkId: string,
    data: { hasSpoiler?: boolean; order?: number },
  ) {
    const publication = await this.prisma.publication.findUnique({
      where: { id: publicationId },
      select: { id: true, projectId: true, createdBy: true, status: true },
    });

    if (!publication) {
      throw new NotFoundException('Publication not found');
    }

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

    const updated = await this.prisma.publicationMedia.update({
      where: { id: mediaLinkId, publicationId },
      data: {
        hasSpoiler: data.hasSpoiler,
        order: data.order,
      },
    });

    // Build snapshot for ready/scheduled publications
    if (
      publication.status === PublicationStatus.READY ||
      publication.status === PublicationStatus.SCHEDULED
    ) {
      await this.snapshotBuilder.buildForPublication(publicationId);
    }

    // Set desync flag for published/failed publications
    if (['PUBLISHED', 'PARTIAL', 'FAILED'].includes(publication.status)) {
      const currentMeta = (publication as any).meta || {};
      if (!currentMeta.isDesynced) {
        await this.prisma.publication.update({
          where: { id: publicationId },
          data: { meta: { ...currentMeta, isDesynced: true } },
        });
      }
    }

    return updated;
  }

  public async prepareCreationMedia(
    data: CreatePublicationDto,
    unsplashPhoto: any,
    userId?: string,
  ) {
    const mediaToCreate: any[] = [];
    let currentOrder = 0;

    if (unsplashPhoto) {
      const unsplashMedia = await this.uploadUnsplashMedia(unsplashPhoto, data.projectId, userId);
      if (unsplashMedia) {
        unsplashMedia.order = currentOrder++;
        mediaToCreate.push(unsplashMedia);
      }
    }

    if (data.imageUrl) {
      const urlMedia = await this.uploadMediaFromUrl(data.imageUrl, data.projectId, userId);
      if (urlMedia) {
        urlMedia.order = currentOrder++;
        mediaToCreate.push(urlMedia);
      }
    }

    if (data.media?.length) {
      mediaToCreate.push(
        ...data.media.map((m, i) => ({
          order: currentOrder++,
          media: { create: { ...m, meta: m.meta } },
        })),
      );
    }

    if (data.existingMediaIds?.length) {
      mediaToCreate.push(
        ...data.existingMediaIds.map(item => {
          const input = this.getMediaInput(item);
          return {
            order: currentOrder++,
            mediaId: input.id,
            hasSpoiler: input.hasSpoiler,
          };
        }),
      );
    }

    return mediaToCreate;
  }

  private async uploadUnsplashMedia(photo: any, projectId: string, userId?: string) {
    try {
      const settings = await this.mediaService.getProjectOptimizationSettings(projectId);
      const optimization = {
        ...settings,
        lossless: false,
        stripMetadata: false,
        autoOrient: false,
        flatten: false,
      };

      const { fileId, metadata } = await this.mediaService.uploadFileFromUrl(
        photo.urls.regular,
        `unsplash-${photo.id}.jpg`,
        userId,
        'publication',
        optimization,
      );

      const authorName = photo.user.name || photo.user.username || photo.id;
      return {
        order: 0,
        media: {
          create: {
            type: MediaType.IMAGE,
            storageType: StorageType.STORAGE,
            storagePath: fileId,
            filename: `unsplash-${photo.id}.jpg`,
            mimeType: metadata.mimeType,
            sizeBytes: metadata.size ? BigInt(metadata.size) : undefined,
            meta: {
              ...metadata,
              unsplashId: photo.id,
              unsplashUrl: photo.links.html,
              unsplashUser: photo.user.name,
              unsplashUsername: photo.user.username,
              unsplashUserUrl: photo.user.links.html,
            },
            description: `Photo by ${authorName} on Unsplash`,
          },
        },
      };
    } catch (err: any) {
      this.logger.error(`Failed to upload Unsplash photo ${photo.id}: ${err.message}`);
      return null;
    }
  }

  private async uploadMediaFromUrl(url: string, projectId: string, userId?: string) {
    try {
      const optimization = await this.mediaService.getProjectOptimizationSettings(projectId);
      const { fileId, metadata } = await this.mediaService.uploadFileFromUrl(
        url,
        undefined,
        userId,
        'publication',
        optimization,
      );

      const filename = url.split('/').pop()?.split('?')[0] || 'image.jpg';
      return {
        order: 0,
        media: {
          create: {
            type: MediaType.IMAGE,
            storageType: StorageType.STORAGE,
            storagePath: fileId,
            filename,
            mimeType: metadata.mimeType,
            sizeBytes: metadata.size ? BigInt(metadata.size) : undefined,
            meta: metadata,
          },
        },
      };
    } catch (err: any) {
      this.logger.error(`Failed to upload image from URL ${url}: ${err.message}`);
      return null;
    }
  }

  private getMediaInput(item: string | PublicationMediaInputDto): {
    id: string;
    hasSpoiler: boolean;
  } {
    if (typeof item === 'string') {
      return { id: item, hasSpoiler: false };
    }
    return { id: item.id, hasSpoiler: !!item.hasSpoiler };
  }
}
