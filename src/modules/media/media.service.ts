import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import type { ServerResponse } from 'http';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateMediaDto, UpdateMediaDto } from './dto/index.js';
import { MediaType, StorageType, Media } from '../../generated/prisma/client.js';
import { pipeline } from 'node:stream/promises';
import {
  getMediaStorageServiceUrl,
  getMediaStorageTimeout,
  getMediaStorageMaxFileSize,
  getImageCompressionOptions,
  getThumbnailQuality,
  getThumbnailMaxDimension,
} from '../../config/media.config.js';
import { PermissionsService } from '../../common/services/permissions.service.js';

/**
 * MediaService - Proxy for Media Storage microservice
 *
 * This service acts as a proxy between Gran Publicador and the Media Storage microservice.
 * It handles:
 * - Streaming file uploads to Media Storage
 * - Proxying file downloads and thumbnails
 * - Managing media metadata in the local database
 * - Telegram file_id support (StorageType.TELEGRAM)
 */
@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly mediaStorageUrl: string;
  private readonly timeout: number;
  private readonly maxFileSize: number;
  private readonly compressionOptions?: Record<string, any>;
  private readonly thumbnailQuality?: number;
  private readonly thumbnailMaxDimension?: number;
  private readonly fetch = global.fetch;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private permissions: PermissionsService,
  ) {
    this.mediaStorageUrl = getMediaStorageServiceUrl();
    this.timeout = getMediaStorageTimeout() * 1000; // Convert to milliseconds
    this.maxFileSize = getMediaStorageMaxFileSize() * 1024 * 1024; // Convert to bytes
    this.compressionOptions = getImageCompressionOptions();
    this.thumbnailQuality = getThumbnailQuality();
    this.thumbnailMaxDimension = getThumbnailMaxDimension();

    this.logger.log(`Media Storage URL: ${this.mediaStorageUrl}`);
    this.logger.log(`Max file size: ${this.maxFileSize} bytes`);
    if (this.compressionOptions) {
      this.logger.log(`Image compression options: ${JSON.stringify(this.compressionOptions)}`);
    }
  }

  /**
   * Safe JSON parser for meta field.
   */
  private parseMeta(meta: any): Record<string, any> {
    if (typeof meta === 'string') {
      try {
        return JSON.parse(meta);
      } catch {
        return {};
      }
    }
    return (meta as Record<string, any>) || {};
  }

  /**
   * Create media record in database.
   */
  async create(data: CreateMediaDto): Promise<Omit<Media, 'meta'> & { meta: Record<string, any> }> {
    this.logger.debug(`Creating media record: type=${data.type}, storageType=${data.storageType}`);

    const { meta, ...rest } = data;

    const created = await this.prisma.media.create({
      data: {
        ...rest,
        meta: (meta || {}) as any,
      },
    });

    this.logger.debug(`Created media record in DB: id=${created.id}`);

    return {
      ...created,
      meta: this.parseMeta(created.meta),
    };
  }

  /**
   * Find all media accessible to user.
   */
  async findAll(
    userId?: string,
  ): Promise<Array<Omit<Media, 'meta'> & { meta: Record<string, any> }>> {
    let where = {};

    if (userId) {
      // Find all projects where user is owner or member
      const userProjects = await this.prisma.project.findMany({
        where: {
          OR: [{ ownerId: userId }, { members: { some: { userId } } }],
        },
        select: { id: true },
      });

      const projectIds = userProjects.map(p => p.id);

      // Filter media linked to publications in these projects or orphaned media
      where = {
        OR: [
          {
            publicationMedia: {
              some: {
                publication: {
                  projectId: { in: projectIds },
                },
              },
            },
          },
          {
            publicationMedia: {
              none: {},
            },
          },
        ],
      };
    }

    const list = await this.prisma.media.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return list.map(media => ({
      ...media,
      meta: this.parseMeta(media.meta),
    }));
  }

  /**
   * Find one media by ID.
   */
  async findOne(id: string): Promise<Omit<Media, 'meta'> & { meta: Record<string, any> }> {
    const media = await this.prisma.media.findUnique({ where: { id } });
    if (!media) {
      this.logger.warn(`Media not found: ${id}`);
      throw new NotFoundException(`Media with ID ${id} not found`);
    }
    return {
      ...media,
      meta: this.parseMeta(media.meta),
    };
  }

  /**
   * Update media metadata.
   */
  async update(
    id: string,
    data: UpdateMediaDto,
  ): Promise<Omit<Media, 'meta'> & { meta: Record<string, any> }> {
    const media = await this.prisma.media.findUnique({ where: { id } });
    if (!media) {
      this.logger.warn(`Media not found for update: ${id}`);
      throw new NotFoundException(`Media with ID ${id} not found`);
    }

    this.logger.debug(`Updating media: ${id}`);
    const { meta, ...rest } = data;

    const updated = await this.prisma.media.update({
      where: { id },
      data: {
        ...rest,
        meta: meta ? (meta as any) : undefined,
      },
    });

    return {
      ...updated,
      meta: this.parseMeta(updated.meta),
    };
  }

  /**
   * Delete media from database and Media Storage.
   */
  async remove(id: string): Promise<Media> {
    const media = await this.prisma.media.findUnique({ where: { id } });
    if (!media) {
      this.logger.warn(`Media not found for deletion: ${id}`);
      throw new NotFoundException(`Media with ID ${id} not found`);
    }

    // Delete from Media Storage if it's a FS file
    if (media.storageType === StorageType.FS) {
      try {
        const fileId = media.storagePath; // storagePath contains the Media Storage fileId
        await this.deleteFileFromStorage(fileId);
        this.logger.log(`Deleted file from Media Storage: ${fileId}`);
      } catch (error) {
        this.logger.error(
          `Failed to delete file from Media Storage: ${(error as Error).message}`,
        );
        // Continue with DB deletion even if storage deletion fails
      }
    }

    // Delete from database
    const deleted = await this.prisma.media.delete({ where: { id } });
    this.logger.log(`Media deleted: ${id}`);

    return deleted;
  }

  /**
   * Upload file to Media Storage microservice.
   * Returns the fileId from Media Storage to be stored in storagePath.
   */
  async uploadFileToStorage(
    buffer: Buffer,
    filename: string,
    mimetype: string,
  ): Promise<{ fileId: string; metadata: Record<string, any> }> {
    this.logger.debug(`Uploading file to Media Storage: ${filename}`);

    try {
      const formData = new FormData();
      // Convert Buffer to Uint8Array for Blob compatibility
      const uint8Array = new Uint8Array(buffer);
      const blob = new Blob([uint8Array], { type: mimetype });
      formData.append('file', blob, filename);

      // Add compression options as individual form fields if available
      if (this.compressionOptions) {
        if (this.compressionOptions.format) {
          formData.append('format', this.compressionOptions.format);
        }
        if (this.compressionOptions.maxDimension !== undefined) {
          formData.append('maxDimension', this.compressionOptions.maxDimension.toString());
        }
        if (this.compressionOptions.stripMetadata !== undefined) {
          formData.append('stripMetadata', this.compressionOptions.stripMetadata.toString());
        }
        if (this.compressionOptions.lossless !== undefined) {
          formData.append('lossless', this.compressionOptions.lossless.toString());
        }
        if (this.compressionOptions.quality !== undefined) {
          formData.append('quality', this.compressionOptions.quality.toString());
        }
        if (this.compressionOptions.avifChromaSubsampling) {
          formData.append('avifChromaSubsampling', this.compressionOptions.avifChromaSubsampling);
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await this.fetch(`${this.mediaStorageUrl}/files`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Media Storage returned ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      this.logger.log(`File uploaded to Media Storage: ${result.id}`);

      return {
        fileId: result.id,
        metadata: {
          originalSize: result.originalSize,
          size: result.size,
          mimeType: result.mimeType,
          checksum: result.checksum,
          url: result.url,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to upload to Media Storage: ${(error as Error).message}`);
      if ((error as any).name === 'AbortError') {
        throw new InternalServerErrorException('Media Storage request timed out');
      }
      throw new InternalServerErrorException(
        `Failed to upload file: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Upload file from URL to Media Storage microservice.
   * Returns the fileId from Media Storage to be stored in storagePath.
   */
  async uploadFileFromUrl(
    url: string,
    filename?: string,
  ): Promise<{ fileId: string; metadata: Record<string, any> }> {
    this.logger.debug(`Uploading file from URL to Media Storage: ${url}`);

    try {
      const body: Record<string, any> = { url };
      if (filename) {
        body.filename = filename;
      }

      // Add compression options as individual fields if available
      if (this.compressionOptions) {
        if (this.compressionOptions.format) {
          body.format = this.compressionOptions.format;
        }
        if (this.compressionOptions.maxDimension !== undefined) {
          body.maxDimension = this.compressionOptions.maxDimension;
        }
        if (this.compressionOptions.stripMetadata !== undefined) {
          body.stripMetadata = this.compressionOptions.stripMetadata;
        }
        if (this.compressionOptions.lossless !== undefined) {
          body.lossless = this.compressionOptions.lossless;
        }
        if (this.compressionOptions.quality !== undefined) {
          body.quality = this.compressionOptions.quality;
        }
        if (this.compressionOptions.avifChromaSubsampling) {
          body.avifChromaSubsampling = this.compressionOptions.avifChromaSubsampling;
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await this.fetch(`${this.mediaStorageUrl}/files/from-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Media Storage returned ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      this.logger.log(`File uploaded from URL to Media Storage: ${result.id}`);

      return {
        fileId: result.id,
        metadata: {
          originalSize: result.originalSize,
          size: result.size,
          mimeType: result.mimeType,
          checksum: result.checksum,
          url: result.url,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to upload from URL to Media Storage: ${(error as Error).message}`);
      if ((error as any).name === 'AbortError') {
        throw new InternalServerErrorException('Media Storage request timed out');
      }
      throw new InternalServerErrorException(
        `Failed to upload file from URL: ${(error as Error).message}`,
      );
    }
  }


  /**
   * Delete file from Media Storage microservice.
   */
  private async deleteFileFromStorage(fileId: string): Promise<void> {
    this.logger.debug(`Deleting file from Media Storage: ${fileId}`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await this.fetch(`${this.mediaStorageUrl}/files/${fileId}`, {
        method: 'DELETE',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok && response.status !== 404) {
        const errorText = await response.text();
        throw new Error(`Media Storage returned ${response.status}: ${errorText}`);
      }

      this.logger.log(`File deleted from Media Storage: ${fileId}`);
    } catch (error) {
      this.logger.error(`Failed to delete from Media Storage: ${(error as Error).message}`);
      if ((error as any).name === 'AbortError') {
        throw new InternalServerErrorException('Media Storage request timed out');
      }
      throw new InternalServerErrorException(
        `Failed to delete file: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Proxy a request to Media Storage and return stream details.
   */
  private async proxyFromStorage(
    url: string,
    method: string = 'GET',
    headers: Record<string, string> = {},
  ): Promise<{
    stream: Readable;
    status: number;
    headers: Record<string, string>;
  }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await this.fetch(url, {
        method,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok && response.status !== 206) {
        throw new Error(`Media Storage returned ${response.status}`);
      }

      const responseHeaders: Record<string, string> = {};
      const skipHeaders = [
        'connection',
        'keep-alive',
        'transfer-encoding',
        'proxy-authenticate',
        'proxy-authorization',
        'te',
        'trailer',
        'upgrade',
      ];

      response.headers.forEach((value, key) => {
        if (!skipHeaders.includes(key.toLowerCase())) {
          responseHeaders[key] = value;
        }
      });

      if (!response.body) {
        throw new Error('Response body is empty');
      }

      return {
        stream: Readable.fromWeb(response.body as any),
        status: response.status,
        headers: responseHeaders,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      this.logger.error(`Failed to proxy from Media Storage (${url}): ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Get file stream from Media Storage.
   */
  async getFileStream(
    fileId: string,
    range?: string,
  ): Promise<{ stream: Readable; status: number; headers: Record<string, string> }> {
    const headers: Record<string, string> = {};
    if (range) {
      headers['Range'] = range;
    }

    return this.proxyFromStorage(`${this.mediaStorageUrl}/files/${fileId}/download`, 'GET', headers);
  }

  /**
   * Get thumbnail stream from Media Storage.
   */
  async getThumbnailStream(
    fileId: string,
    width: number,
    height: number,
    quality?: number,
  ): Promise<{ stream: Readable; status: number; headers: Record<string, string> }> {
    const params = new URLSearchParams({
      width: width.toString(),
      height: height.toString(),
    });

    const finalQuality = quality ?? this.thumbnailQuality;
    if (finalQuality) {
      params.append('quality', finalQuality.toString());
    }

    return this.proxyFromStorage(
      `${this.mediaStorageUrl}/files/${fileId}/thumbnail?${params.toString()}`,
    );
  }

  /**
   * Get media file stream and metadata.
   * For StorageType.FS: proxy from Media Storage
   * For StorageType.TELEGRAM: stream from Telegram API
   */
  async getMediaFile(
    id: string,
    userId?: string,
    range?: string,
  ): Promise<{ stream: Readable; status: number; headers: Record<string, string> }> {
    // Check access
    if (userId) {
      await this.checkMediaAccess(id, userId);
    }

    const media = await this.findOne(id);

    if (media.storageType === StorageType.FS) {
      // Proxy from Media Storage
      const fileId = media.storagePath;
      return this.getFileStream(fileId, range);
    } else if (media.storageType === StorageType.TELEGRAM) {
      // Stream from Telegram API
      return this.getTelegramStream(
        media.storagePath,
        media.mimeType ?? undefined,
        media.filename ?? undefined,
      );
    } else {
      throw new BadRequestException('Unsupported storage type');
    }
  }

  /**
   * Get media thumbnail stream and metadata.
   * For StorageType.FS: proxy from Media Storage
   * For StorageType.TELEGRAM: stream thumbnail file_id from Telegram API
   */
  async getMediaThumbnail(
    id: string,
    width: number,
    height: number,
    quality?: number,
    userId?: string,
  ): Promise<{ stream: Readable; status: number; headers: Record<string, string> }> {
    // Check access
    if (userId) {
      await this.checkMediaAccess(id, userId);
    }

    const media = await this.findOne(id);

    if (media.storageType === StorageType.FS) {
      // Proxy from Media Storage
      const fileId = media.storagePath;
      return this.getThumbnailStream(fileId, width, height, quality);
    } else if (media.storageType === StorageType.TELEGRAM) {
      // Use thumbnail file_id if available in meta, otherwise fallback to main file_id
      const thumbnailFileId = media.meta.telegram?.thumbnailFileId || media.storagePath;
      // Telegram thumbnails are usually JPEGs
      return this.getTelegramStream(thumbnailFileId, 'image/jpeg');
    } else {
      throw new BadRequestException('Unsupported storage type');
    }
  }

  /**
   * Get stream from Telegram API.
   */
  private async getTelegramStream(
    fileId: string,
    mimeType?: string,
    filename?: string,
  ): Promise<{ stream: Readable; status: number; headers: Record<string, string> }> {
    const telegramBotToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!telegramBotToken) {
      throw new InternalServerErrorException('Telegram bot token not configured');
    }

    try {
      // The storagePath (or thumbnailFileId) contains the Telegram file_id
      const getFileUrl = `https://api.telegram.org/bot${telegramBotToken}/getFile?file_id=${encodeURIComponent(
        fileId,
      )}`;

      const getFileResponse = await this.fetch(getFileUrl);
      if (!getFileResponse.ok) {
        this.logger.warn(`Telegram API error for file_id ${fileId}: ${getFileResponse.status}`);
        throw new InternalServerErrorException('Telegram API error');
      }

      const getFileData = await getFileResponse.json();
      if (!getFileData.ok || !getFileData.result?.file_path) {
        this.logger.warn(`Invalid Telegram file_id or file not found: ${fileId}`);
        throw new NotFoundException('File not found in Telegram');
      }

      const filePath = getFileData.result.file_path;
      const downloadUrl = `https://api.telegram.org/file/bot${telegramBotToken}/${filePath}`;

      const downloadResponse = await this.fetch(downloadUrl);
      if (!downloadResponse.ok) {
        this.logger.warn(`Failed to download from Telegram (${fileId}): ${downloadResponse.status}`);
        throw new InternalServerErrorException('Failed to download from Telegram');
      }

      const headers: Record<string, string> = {};
      if (mimeType) {
        headers['Content-Type'] = mimeType;
      }
      if (filename) {
        headers['Content-Disposition'] = `inline; filename="${filename}"`;
      }

      if (!downloadResponse.body) {
        throw new InternalServerErrorException('Telegram response body is empty');
      }

      return {
        stream: Readable.fromWeb(downloadResponse.body as any),
        status: downloadResponse.status,
        headers,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.error(`Failed to get stream from Telegram (${fileId}): ${(error as Error).message}`);
      throw new InternalServerErrorException('Failed to stream file from Telegram');
    }
  }

  /**
   * Check if user has access to media.
   */
  public async checkMediaAccess(mediaId: string, userId: string): Promise<void> {
    const media = await this.prisma.media.findUnique({
      where: { id: mediaId },
      include: {
        publicationMedia: {
          include: {
            publication: {
              select: { projectId: true, createdBy: true },
            },
          },
        },
      },
    });

    if (!media) {
      throw new NotFoundException('Media not found');
    }

    // If media is not linked to any publication, allow access (orphaned media)
    if (!media.publicationMedia || media.publicationMedia.length === 0) {
      return;
    }

    // Check access to each linked publication's project
    for (const pm of media.publicationMedia) {
      const projectId = pm.publication.projectId;
      const createdBy = pm.publication.createdBy;

      // Personal draft (no project)
      if (!projectId) {
        if (createdBy === userId) {
          return; // User owns this personal draft
        }
        continue;
      }

      // Project publication - check project access
      try {
        await this.permissions.checkProjectAccess(projectId, userId);
        return; // User has access to at least one project
      } catch {
        continue;
      }
    }

    throw new ForbiddenException('You do not have access to this media');
  }
}
