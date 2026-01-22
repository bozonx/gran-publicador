import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  RequestTimeoutException,
  ServiceUnavailableException,
  BadGatewayException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import { request } from 'undici';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateMediaDto, UpdateMediaDto } from './dto/index.js';
import { MediaType, StorageType, Media } from '../../generated/prisma/client.js';
import { MediaConfig } from '../../config/media.config.js';
import { PermissionsService } from '../../common/services/permissions.service.js';

/**
 * MediaService - Proxy for Media Storage microservice
 */
@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private permissions: PermissionsService,
  ) {
    const config = this.configService.get<MediaConfig>('media');
    if (config?.serviceUrl) {
      this.logger.log(`Media Storage URL: ${config.serviceUrl}`);
    }
  }

  private get config(): MediaConfig {
    return this.configService.get<MediaConfig>('media')!;
  }

  private parseMeta(meta: any): Record<string, any> {
    if (typeof meta === 'string') {
      try {
        return JSON.parse(meta);
      } catch (error) {
        this.logger.warn(`Failed to parse meta JSON: ${(error as Error).message}`);
        return {};
      }
    }
    return (meta as Record<string, any>) || {};
  }

  private isConnectionError(error: unknown): boolean {
    const err = error as { code?: string; cause?: { code?: string } };
    return (
      err?.code === 'ECONNREFUSED' ||
      err?.code === 'ENOTFOUND' ||
      err?.code === 'ECONNRESET' ||
      err?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
      err?.cause?.code === 'ECONNREFUSED' ||
      err?.cause?.code === 'ENOTFOUND'
    );
  }

  private isTimeoutError(error: unknown): boolean {
    const err = error as { name?: string; code?: string };
    return (
      err?.name === 'TimeoutError' ||
      err?.code === 'UND_ERR_HEADERS_TIMEOUT' ||
      err?.code === 'UND_ERR_BODY_TIMEOUT'
    );
  }

  private handleMicroserviceError(error: unknown, operation: string): never {
    this.logger.error(
      `Media Storage microservice error during ${operation}: ${(error as Error).message}`,
    );

    if (this.isTimeoutError(error)) {
      throw new RequestTimeoutException('Media Storage microservice request timed out');
    }

    if (this.isConnectionError(error)) {
      throw new ServiceUnavailableException(
        'Media Storage microservice is unavailable. Please check if the service is running.',
      );
    }

    if (error instanceof BadRequestException || error instanceof NotFoundException) {
      throw error;
    }

    throw new BadGatewayException(`Media Storage microservice error: ${(error as Error).message}`);
  }

  private normalizeCompressionOptions(options: any): Record<string, any> {
    if (!options || typeof options !== 'object') return {};

    const normalized = { ...options };

    // Fix legacy field name
    if (normalized.avifChromaSubsampling) {
      normalized.chromaSubsampling = normalized.avifChromaSubsampling;
      delete normalized.avifChromaSubsampling;
    }

    // Drop internal UI flags and unknown keys.
    const allowedKeys = new Set([
      'format',
      'quality',
      'maxDimension',
      'lossless',
      'stripMetadata',
      'autoOrient',
      'flatten',
      'chromaSubsampling',
      'effort',
    ]);

    for (const key of Object.keys(normalized)) {
      if (!allowedKeys.has(key)) {
        delete normalized[key];
      }
    }

    return normalized;
  }

  async create(data: CreateMediaDto): Promise<Omit<Media, 'meta'> & { meta: Record<string, any> }> {
    const { meta, sizeBytes, ...rest } = data;
    const created = await this.prisma.media.create({
      data: {
        ...rest,
        sizeBytes: sizeBytes !== undefined && sizeBytes !== null ? BigInt(sizeBytes) : undefined,
        meta: (meta || {}) as any,
      },
    });
    return { ...created, meta: this.parseMeta(created.meta) };
  }

  async findAll(
    userId?: string,
  ): Promise<Array<Omit<Media, 'meta'> & { meta: Record<string, any> }>> {
    let where = {};
    if (userId) {
      const userProjects = await this.prisma.project.findMany({
        where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
        select: { id: true },
      });
      const projectIds = userProjects.map(p => p.id);
      where = {
        OR: [
          { publicationMedia: { some: { publication: { projectId: { in: projectIds } } } } },
          { publicationMedia: { none: {} } },
        ],
      };
    }
    const list = await this.prisma.media.findMany({ where, orderBy: { createdAt: 'desc' } });
    return list.map(media => ({ ...media, meta: this.parseMeta(media.meta) }));
  }

  async findOne(id: string): Promise<Omit<Media, 'meta'> & { meta: Record<string, any> }> {
    const media = await this.prisma.media.findUnique({ where: { id } });
    if (!media) throw new NotFoundException(`Media with ID ${id} not found`);
    return { ...media, meta: this.parseMeta(media.meta) };
  }

  async update(
    id: string,
    data: UpdateMediaDto,
  ): Promise<Omit<Media, 'meta'> & { meta: Record<string, any> }> {
    const media = await this.prisma.media.findUnique({ where: { id } });
    if (!media) throw new NotFoundException(`Media with ID ${id} not found`);
    const { meta, sizeBytes, ...rest } = data;
    const updated = await this.prisma.media.update({
      where: { id },
      data: {
        ...rest,
        sizeBytes: sizeBytes !== undefined && sizeBytes !== null ? BigInt(sizeBytes) : undefined,
        meta: meta ? (meta as any) : undefined,
      },
    });
    return { ...updated, meta: this.parseMeta(updated.meta) };
  }

  async remove(id: string): Promise<Media> {
    const media = await this.prisma.media.findUnique({ where: { id } });
    if (!media) throw new NotFoundException(`Media with ID ${id} not found`);
    if (media.storageType === StorageType.FS) {
      try {
        await this.deleteFileFromStorage(media.storagePath);
      } catch (error) {
        this.logger.error(`Failed to delete file from Media Storage: ${(error as Error).message}`);
      }
    }
    return this.prisma.media.delete({ where: { id } });
  }

  async uploadFileToStorage(
    fileStream: Readable,
    filename: string,
    mimetype: string,
    userId?: string,
    purpose?: string,
    optimize?: Record<string, any>,
  ): Promise<{ fileId: string; metadata: Record<string, any> }> {
    const config = this.config;
    if (!config.serviceUrl) {
      throw new InternalServerErrorException('Media Storage service is not configured');
    }

    // Use form-data library for streaming support
    const FormData = (await import('form-data')).default;
    const formData = new FormData();
    formData.append('appId', config.appId);
    if (userId) formData.append('userId', userId);
    if (purpose) formData.append('purpose', purpose);

    let compression = optimize ? this.normalizeCompressionOptions(optimize) : undefined;
    if (compression?.enabled === false) compression = undefined;
    if (!mimetype.toLowerCase().startsWith('image/')) {
      compression = undefined;
    }
    if (compression) formData.append('optimize', JSON.stringify(compression));

    this.logger.debug(
      `Uploading file to storage: filename="${filename}", mimetype="${mimetype}", appId="${config.appId}", optimize=${compression ? JSON.stringify(compression) : 'none'}`,
    );

    // Stream the file directly
    formData.append('file', fileStream, { filename, contentType: mimetype });

    try {
      const formHeaders = formData.getHeaders();
      const response = await request(`${config.serviceUrl}/files`, {
        method: 'POST',
        body: formData,
        headers: {
          ...formHeaders,
        },
        headersTimeout: (config.timeoutSecs || 60) * 1000,
      });

      if (response.statusCode >= 400) {
        const errorBody = await response.body.json().catch(() => ({}));
        const errorMessage = (errorBody as any).message || 'Microservice error';
        
        if (response.statusCode === 400) throw new BadRequestException(errorMessage);
        if (response.statusCode === 404) throw new NotFoundException(errorMessage);
        throw new BadGatewayException(`Media Storage error: ${errorMessage}`);
      }

      const result = (await response.body.json()) as any;
      return {
        fileId: result.id,
        metadata: {
          originalSize: result.originalSize,
          size: result.size,
          mimeType: result.mimeType,
          originalMimeType: result.originalMimeType,
          optimizationParams: result.optimizationParams,
          checksum: result.checksum,
          url: result.url,
        },
      };
    } catch (error) {
      this.handleMicroserviceError(error, 'file upload');
    }
  }

  async uploadFileFromUrl(
    url: string,
    filename?: string,
    userId?: string,
    purpose?: string,
    optimize?: Record<string, any>,
  ): Promise<{ fileId: string; metadata: Record<string, any> }> {
    const config = this.config;
    if (!config.serviceUrl) {
      throw new InternalServerErrorException('Media Storage service is not configured');
    }

    try {
      const body: Record<string, any> = { url, appId: config.appId };
      if (filename) body.filename = filename;
      if (userId) body.userId = userId;
      if (purpose) body.purpose = purpose;
      let compression = optimize ? this.normalizeCompressionOptions(optimize) : undefined;
      if (compression?.enabled === false) compression = undefined;
      if (compression) body.optimize = compression;

      const response = await request(`${config.serviceUrl}/files/from-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        headersTimeout: (config.timeoutSecs || 60) * 1000,
      });

      if (response.statusCode >= 400) {
        const errorBody = await response.body.json().catch(() => ({}));
        const errorMessage = (errorBody as any).message || 'Microservice error';
        if (response.statusCode === 400) throw new BadRequestException(errorMessage);
        if (response.statusCode === 404) throw new NotFoundException(errorMessage);
        throw new BadGatewayException(`Media Storage error: ${errorMessage}`);
      }

      const result = (await response.body.json()) as any;
      return {
        fileId: result.id,
        metadata: {
          originalSize: result.originalSize,
          size: result.size,
          mimeType: result.mimeType,
          originalMimeType: result.originalMimeType,
          optimizationParams: result.optimizationParams,
          checksum: result.checksum,
          url: result.url,
        },
      };
    } catch (error) {
      this.handleMicroserviceError(error, 'URL upload');
    }
  }

  async reprocessFile(
    id: string,
    optimize: Record<string, any>,
    userId?: string,
  ): Promise<{ fileId: string; metadata: Record<string, any> }> {
    const media = await this.findOne(id);
    if (media.storageType !== StorageType.FS)
      throw new BadRequestException('Only FS media can be reprocessed');
    if (userId) await this.checkMediaAccess(id, userId);

    const config = this.config;
    try {
      const response = await request(
        `${config.serviceUrl}/files/${media.storagePath}/reprocess`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.normalizeCompressionOptions(optimize)),
          headersTimeout: (config.timeoutSecs || 60) * 1000,
        },
      );

      if (response.statusCode >= 400) {
        const errorBody = await response.body.json().catch(() => ({}));
        throw new BadGatewayException(`Media Storage error: ${(errorBody as any).message || 'Microservice error'}`);
      }

      const result = (await response.body.json()) as any;
      return {
        fileId: result.id,
        metadata: {
          originalSize: result.originalSize,
          size: result.size,
          mimeType: result.mimeType,
          originalMimeType: result.originalMimeType,
          optimizationParams: result.optimizationParams,
          checksum: result.checksum,
          url: result.url,
        },
      };
    } catch (error) {
      this.handleMicroserviceError(error, 'file reprocess');
    }
  }

  private async deleteFileFromStorage(fileId: string): Promise<void> {
    const config = this.config;
    if (!config.serviceUrl) return;

    try {
      await request(`${config.serviceUrl}/files/${fileId}`, {
        method: 'DELETE',
        headersTimeout: (config.timeoutSecs || 60) * 1000,
      });
    } catch (error) {
      this.logger.error(`Failed to delete file ${fileId} from Media Storage: ${(error as Error).message}`);
    }
  }

  async getFileStream(
    fileId: string,
    range?: string,
  ): Promise<{ stream: Readable; status: number; headers: Record<string, string> }> {
    const config = this.config;
    const reqHeaders: Record<string, string> = range ? { Range: range } : {};

    try {
      const response = await request(`${config.serviceUrl}/files/${fileId}/download`, {
        method: 'GET',
        headers: reqHeaders,
        headersTimeout: (config.timeoutSecs || 60) * 1000,
      });

      if (response.statusCode >= 400 && response.statusCode !== 206) {
        throw new Error(`Media Storage returned ${response.statusCode}`);
      }

      const responseHeaders: Record<string, string> = {};
      const skipHeaders = ['connection', 'keep-alive', 'transfer-encoding'];
      
      for (const [key, value] of Object.entries(response.headers)) {
        if (!skipHeaders.includes(key.toLowerCase()) && typeof value === 'string') {
          responseHeaders[key] = value;
        }
      }

      return {
        stream: (response.body as any) as Readable,
        status: response.statusCode,
        headers: responseHeaders,
      };
    } catch (error) {
      this.handleMicroserviceError(error, 'file download');
    }
  }

  async getThumbnailStream(
    fileId: string,
    width: number,
    height: number,
    quality?: number,
    fit?: string,
  ): Promise<{ stream: Readable; status: number; headers: Record<string, string> }> {
    const config = this.config;
    const params = new URLSearchParams({ width: width.toString(), height: height.toString() });
    const finalQuality = quality ?? config.thumbnailQuality;
    if (finalQuality) params.append('quality', finalQuality.toString());
    if (fit) params.append('fit', fit);

    try {
      const response = await request(
        `${config.serviceUrl}/files/${fileId}/thumbnail?${params.toString()}`,
        {
          method: 'GET',
          headersTimeout: (config.timeoutSecs || 60) * 1000,
        },
      );

      if (response.statusCode >= 400) throw new Error(`Media Storage returned ${response.statusCode}`);

      const responseHeaders: Record<string, string> = {};
      for (const [key, value] of Object.entries(response.headers)) {
        if (typeof value === 'string') responseHeaders[key] = value;
      }

      return {
        stream: (response.body as any) as Readable,
        status: response.statusCode,
        headers: responseHeaders,
      };
    } catch (error) {
      this.handleMicroserviceError(error, 'thumbnail');
    }
  }

  async getFileInfo(fileId: string): Promise<Record<string, any>> {
    const config = this.config;
    try {
      const response = await request(`${config.serviceUrl}/files/${fileId}`, {
        method: 'GET',
        headersTimeout: (config.timeoutSecs || 60) * 1000,
      });

      if (response.statusCode >= 400) throw new Error(`Media Storage returned ${response.statusCode}`);
      return (await response.body.json()) as any;
    } catch (error) {
      this.handleMicroserviceError(error, 'file info');
    }
  }

  async getMediaFile(
    id: string,
    userId?: string,
    range?: string,
  ): Promise<{ stream: Readable; status: number; headers: Record<string, string> }> {
    if (userId) await this.checkMediaAccess(id, userId);
    const media = await this.findOne(id);
    if (media.storageType === StorageType.FS) return this.getFileStream(media.storagePath, range);
    else if (media.storageType === StorageType.TELEGRAM)
      return this.getTelegramStream(
        media.storagePath,
        media.mimeType ?? undefined,
        media.filename ?? undefined,
      );
    throw new BadRequestException('Unsupported storage type');
  }

  async getMediaThumbnail(
    id: string,
    width: number,
    height: number,
    quality?: number,
    userId?: string,
    fit?: string,
  ): Promise<{ stream: Readable; status: number; headers: Record<string, string> }> {
    if (userId) await this.checkMediaAccess(id, userId);
    const media = await this.findOne(id);
    if (media.storageType === StorageType.FS)
      return this.getThumbnailStream(media.storagePath, width, height, quality, fit);
    else if (media.storageType === StorageType.TELEGRAM) {
      const thumbnailFileId = media.meta.telegram?.thumbnailFileId || media.storagePath;
      return this.getTelegramStream(thumbnailFileId, 'image/jpeg');
    }
    throw new BadRequestException('Unsupported storage type');
  }

  private async getTelegramStream(
    fileId: string,
    mimeType?: string,
    filename?: string,
  ): Promise<{ stream: Readable; status: number; headers: Record<string, string> }> {
    const telegramBotToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!telegramBotToken)
      throw new InternalServerErrorException('Telegram bot token not configured');

    const getFileUrl = `https://api.telegram.org/bot${telegramBotToken}/getFile?file_id=${encodeURIComponent(fileId)}`;
    const getFileResponse = await request(getFileUrl, { method: 'GET' });
    const getFileData = (await getFileResponse.body.json()) as any;

    if (!getFileData.ok || !getFileData.result?.file_path)
      throw new NotFoundException('File not found in Telegram');

    const downloadUrl = `https://api.telegram.org/file/bot${telegramBotToken}/${getFileData.result.file_path}`;
    const downloadResponse = await request(downloadUrl, { method: 'GET' });

    if (downloadResponse.statusCode >= 400)
      throw new InternalServerErrorException('Failed to download from Telegram');

    const headers: Record<string, string> = {};
    if (mimeType) headers['Content-Type'] = mimeType;
    if (filename) headers['Content-Disposition'] = `inline; filename="${filename}"`;

    return {
      stream: (downloadResponse.body as any) as Readable,
      status: downloadResponse.statusCode,
      headers,
    };
  }

  public async checkMediaAccess(mediaId: string, userId: string): Promise<void> {
    const media = await this.prisma.media.findUnique({
      where: { id: mediaId },
      include: {
        publicationMedia: {
          include: { publication: { select: { projectId: true, createdBy: true } } },
        },
      },
    });
    if (!media) throw new NotFoundException('Media not found');
    if (!media.publicationMedia || media.publicationMedia.length === 0) return;
    for (const pm of media.publicationMedia) {
      const projectId = pm.publication.projectId;
      if (!projectId) {
        if (pm.publication.createdBy === userId) return;
        continue;
      }
      try {
        await this.permissions.checkProjectAccess(projectId, userId);
        return;
      } catch (error) {
        this.logger.debug(
          `User ${userId} does not have access to project ${projectId}: ${(error as Error).message}`,
        );
        continue;
      }
    }
    throw new ForbiddenException('You do not have access to this media');
  }

  /**
   * Helper to retrieve project optimization settings.
   */
  public async getProjectOptimizationSettings(
    projectId: string,
  ): Promise<Record<string, any> | undefined> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { preferences: true },
    });

    if (!project?.preferences) {
      return undefined;
    }

    const prefs = project.preferences as Record<string, any>;
    return prefs.mediaOptimization;
  }
}
