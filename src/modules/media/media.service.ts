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
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateMediaDto, UpdateMediaDto } from './dto/index.js';
import { MediaType, StorageType, Media } from '../../generated/prisma/client.js';
import {
  getMediaStorageServiceUrl,
  getMediaStorageTimeout,
  getMediaStorageMaxFileSize,
  getThumbnailQuality,
  getMediaStorageAppId,
} from '../../config/media.config.js';
import { PermissionsService } from '../../common/services/permissions.service.js';

/**
 * MediaService - Proxy for Media Storage microservice
 */
@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly mediaStorageUrl: string;
  private readonly timeout: number;
  private readonly maxFileSize: number;
  private readonly thumbnailQuality?: number;
  private readonly appId: string;
  private readonly fetch = global.fetch;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private permissions: PermissionsService,
  ) {
    this.mediaStorageUrl = getMediaStorageServiceUrl();
    this.timeout = getMediaStorageTimeout() * 1000;
    this.maxFileSize = getMediaStorageMaxFileSize() * 1024 * 1024;
    this.thumbnailQuality = getThumbnailQuality();
    this.appId = getMediaStorageAppId();

    this.logger.log(`Media Storage URL: ${this.mediaStorageUrl}`);
  }

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

  private normalizeCompressionOptions(options: any): Record<string, any> {
    if (!options || typeof options !== 'object') return {};
    
    const normalized = { ...options };
    
    // Fix legacy field name
    if (normalized.avifChromaSubsampling) {
      normalized.chromaSubsampling = normalized.avifChromaSubsampling;
      delete normalized.avifChromaSubsampling;
    }

    return normalized;
  }

  async create(data: CreateMediaDto): Promise<Omit<Media, 'meta'> & { meta: Record<string, any> }> {
    const { meta, ...rest } = data;
    const created = await this.prisma.media.create({
      data: { ...rest, meta: (meta || {}) as any },
    });
    return { ...created, meta: this.parseMeta(created.meta) };
  }

  async findAll(userId?: string): Promise<Array<Omit<Media, 'meta'> & { meta: Record<string, any> }>> {
    let where = {};
    if (userId) {
      const userProjects = await this.prisma.project.findMany({
        where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
        select: { id: true },
      });
      const projectIds = userProjects.map((p) => p.id);
      where = {
        OR: [
          { publicationMedia: { some: { publication: { projectId: { in: projectIds } } } } },
          { publicationMedia: { none: {} } },
        ],
      };
    }
    const list = await this.prisma.media.findMany({ where, orderBy: { createdAt: 'desc' } });
    return list.map((media) => ({ ...media, meta: this.parseMeta(media.meta) }));
  }

  async findOne(id: string): Promise<Omit<Media, 'meta'> & { meta: Record<string, any> }> {
    const media = await this.prisma.media.findUnique({ where: { id } });
    if (!media) throw new NotFoundException(`Media with ID ${id} not found`);
    return { ...media, meta: this.parseMeta(media.meta) };
  }

  async update(id: string, data: UpdateMediaDto): Promise<Omit<Media, 'meta'> & { meta: Record<string, any> }> {
    const media = await this.prisma.media.findUnique({ where: { id } });
    if (!media) throw new NotFoundException(`Media with ID ${id} not found`);
    const { meta, ...rest } = data;
    const updated = await this.prisma.media.update({
      where: { id },
      data: { ...rest, meta: meta ? (meta as any) : undefined },
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

  /**
   * Helper to generate a multipart/form-data stream manually to avoid buffering.
   */
  private async *generateMultipart(
    boundary: string,
    filename: string,
    mimetype: string,
    fileStream: Readable,
    fields: Record<string, string>,
  ) {
    const encoder = new TextEncoder();
    for (const [name, value] of Object.entries(fields)) {
      yield encoder.encode(`--${boundary}\r\n`);
      yield encoder.encode(`Content-Disposition: form-data; name="${name}"\r\n\r\n`);
      yield encoder.encode(`${value}\r\n`);
    }
    yield encoder.encode(`--${boundary}\r\n`);
    yield encoder.encode(`Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`);
    yield encoder.encode(`Content-Type: ${mimetype}\r\n\r\n`);
    for await (const chunk of fileStream) {
      yield chunk;
    }
    yield encoder.encode(`\r\n--${boundary}--\r\n`);
  }

  async uploadFileToStorage(
    fileStream: Readable,
    filename: string,
    mimetype: string,
    userId?: string,
    purpose?: string,
    optimize?: Record<string, any>,
  ): Promise<{ fileId: string; metadata: Record<string, any> }> {
    const boundary = `----NodeBoundary${Math.random().toString(16).substring(2)}`;
    const fields: Record<string, string> = { appId: this.appId };
    if (userId) fields.userId = userId;
    if (purpose) fields.purpose = purpose;

    let compression = optimize ? this.normalizeCompressionOptions(optimize) : undefined;
    if (compression && compression.enabled === false) compression = undefined;
    
    // Log fields for debugging
    this.logger.debug(`Uploading with fields: ${JSON.stringify(fields)}`);

    const multipartStream = Readable.from(this.generateMultipart(boundary, filename, mimetype, fileStream, fields));
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      this.logger.debug(`Sending POST request to: ${this.mediaStorageUrl}/files`);
      const response = await this.fetch(`${this.mediaStorageUrl}/files`, {
        method: 'POST',
        headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
        body: Readable.toWeb(multipartStream) as any,
        duplex: 'half',
        signal: controller.signal,
      } as any);

      clearTimeout(timeoutId);
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = errorText;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorText;
        } catch {
          // Use raw text if not JSON
        }
        this.logger.error(`Media Storage returned error ${response.status}: ${errorMessage}`);
        throw new Error(errorMessage);
      }

      const result = await response.json();
      this.logger.debug(`Media Storage response received for file: ${result.id}`);
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
      clearTimeout(timeoutId);
      this.logger.error(`Failed to upload to Media Storage: ${(error as Error).message}`);
      throw new InternalServerErrorException(`Failed to upload file: ${(error as Error).message}`);
    }
  }

  async uploadFileFromUrl(
    url: string,
    filename?: string,
    userId?: string,
    purpose?: string,
    optimize?: Record<string, any>,
  ): Promise<{ fileId: string; metadata: Record<string, any> }> {
    try {
      const body: Record<string, any> = { url, appId: this.appId };
      if (filename) body.filename = filename;
      if (userId) body.userId = userId;
      if (purpose) body.purpose = purpose;
      let compression = optimize ? this.normalizeCompressionOptions(optimize) : undefined;
      if (compression && compression.enabled === false) compression = undefined;
      if (compression) body.optimize = compression;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await this.fetch(`${this.mediaStorageUrl}/files/from-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = errorText;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorText;
        } catch {
          // Use raw text
        }
        this.logger.error(`Media Storage returned error ${response.status}: ${errorMessage}`);
        throw new Error(errorMessage);
      }

      const result = await response.json();
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
      this.logger.error(`Failed to upload from URL: ${(error as Error).message}`);
      throw new InternalServerErrorException(`Failed to upload file: ${(error as Error).message}`);
    }
  }

  async reprocessFile(
    id: string,
    optimize: Record<string, any>,
    userId?: string,
  ): Promise<{ fileId: string; metadata: Record<string, any> }> {
    const media = await this.findOne(id);
    if (media.storageType !== StorageType.FS) throw new BadRequestException('Only FS media can be reprocessed');
    if (userId) await this.checkMediaAccess(id, userId);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      const response = await this.fetch(`${this.mediaStorageUrl}/files/${media.storagePath}/reprocess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.normalizeCompressionOptions(optimize)),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = errorText;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorText;
        } catch {
          // Use raw text
        }
        this.logger.error(`Media Storage returned error ${response.status}: ${errorMessage}`);
        throw new Error(errorMessage);
      }
      const result = await response.json();
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
      this.logger.error(`Failed to reprocess: ${(error as Error).message}`);
      throw new InternalServerErrorException(`Failed to reprocess file: ${(error as Error).message}`);
    }
  }

  private async deleteFileFromStorage(fileId: string): Promise<void> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      const response = await this.fetch(`${this.mediaStorageUrl}/files/${fileId}`, {
        method: 'DELETE',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (error) {
      this.logger.error(`Failed to delete from Media Storage: ${(error as Error).message}`);
    }
  }

  async getFileStream(
    fileId: string,
    range?: string,
  ): Promise<{ stream: Readable; status: number; headers: Record<string, string> }> {
    const headers: Record<string, string> = range ? { Range: range } : {};
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    try {
      const response = await this.fetch(`${this.mediaStorageUrl}/files/${fileId}/download`, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok && response.status !== 206) throw new Error(`Media Storage returned ${response.status}`);
      const responseHeaders: Record<string, string> = {};
      const skipHeaders = ['connection', 'keep-alive', 'transfer-encoding', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'upgrade'];
      response.headers.forEach((value, key) => {
        if (!skipHeaders.includes(key.toLowerCase())) responseHeaders[key] = value;
      });
      if (!response.body) throw new Error('Response body is empty');
      return { stream: Readable.fromWeb(response.body as any), status: response.status, headers: responseHeaders };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  async getThumbnailStream(
    fileId: string,
    width: number,
    height: number,
    quality?: number,
    fit?: string,
  ): Promise<{ stream: Readable; status: number; headers: Record<string, string> }> {
    const params = new URLSearchParams({ width: width.toString(), height: height.toString() });
    const finalQuality = quality ?? this.thumbnailQuality;
    if (finalQuality) params.append('quality', finalQuality.toString());
    if (fit) params.append('fit', fit);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    try {
      const response = await this.fetch(`${this.mediaStorageUrl}/files/${fileId}/thumbnail?${params.toString()}`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`Media Storage returned ${response.status}`);
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => { responseHeaders[key] = value; });
      if (!response.body) throw new Error('Response body is empty');
      return { stream: Readable.fromWeb(response.body as any), status: response.status, headers: responseHeaders };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
  
  async getFileInfo(fileId: string): Promise<Record<string, any>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    try {
      const response = await this.fetch(`${this.mediaStorageUrl}/files/${fileId}`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`Media Storage returned ${response.status}`);
      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      this.logger.error(`Failed to get file info from Media Storage: ${(error as Error).message}`);
      throw error;
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
    else if (media.storageType === StorageType.TELEGRAM) return this.getTelegramStream(media.storagePath, media.mimeType ?? undefined, media.filename ?? undefined);
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
    if (media.storageType === StorageType.FS) return this.getThumbnailStream(media.storagePath, width, height, quality, fit);
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
    if (!telegramBotToken) throw new InternalServerErrorException('Telegram bot token not configured');
    const getFileUrl = `https://api.telegram.org/bot${telegramBotToken}/getFile?file_id=${encodeURIComponent(fileId)}`;
    const getFileResponse = await this.fetch(getFileUrl);
    const getFileData = await getFileResponse.json();
    if (!getFileData.ok || !getFileData.result?.file_path) throw new NotFoundException('File not found in Telegram');
    const downloadUrl = `https://api.telegram.org/file/bot${telegramBotToken}/${getFileData.result.file_path}`;
    const downloadResponse = await this.fetch(downloadUrl);
    if (!downloadResponse.ok) throw new InternalServerErrorException('Failed to download from Telegram');
    const headers: Record<string, string> = {};
    if (mimeType) headers['Content-Type'] = mimeType;
    if (filename) headers['Content-Disposition'] = `inline; filename="${filename}"`;
    if (!downloadResponse.body) throw new InternalServerErrorException('Telegram response body is empty');
    return { stream: Readable.fromWeb(downloadResponse.body as any), status: downloadResponse.status, headers };
  }

  public async checkMediaAccess(mediaId: string, userId: string): Promise<void> {
    const media = await this.prisma.media.findUnique({
      where: { id: mediaId },
      include: { publicationMedia: { include: { publication: { select: { projectId: true, createdBy: true } } } } },
    });
    if (!media) throw new NotFoundException('Media not found');
    if (!media.publicationMedia || media.publicationMedia.length === 0) return;
    for (const pm of media.publicationMedia) {
      const projectId = pm.publication.projectId;
      if (!projectId) { if (pm.publication.createdBy === userId) return; continue; }
      try { await this.permissions.checkProjectAccess(projectId, userId); return; } catch { continue; }
    }
    throw new ForbiddenException('You do not have access to this media');
  }

  /**
   * Helper to retrieve project optimization settings.
   */
  public async getProjectOptimizationSettings(projectId: string): Promise<Record<string, any> | undefined> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { preferences: true },
    });

    if (!project || !project.preferences) {
      return undefined;
    }

    const prefs = project.preferences as Record<string, any>;
    // Assuming settings are stored under 'mediaOptimization' key in project preferences
    // Adjust this path if the structure is different
    return prefs.mediaOptimization;
  }
}
