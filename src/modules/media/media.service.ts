import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join, normalize, basename, resolve } from 'path';
import { mkdir, writeFile, unlink, stat, readFile } from 'fs/promises';
import { Readable } from 'stream';
import { createReadStream, existsSync } from 'fs';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import type { ServerResponse } from 'http';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateMediaDto, UpdateMediaDto } from './dto/index.js';
import { MediaType, StorageType, Media } from '../../generated/prisma/client.js';
import { getMediaDir, getThumbnailsDir } from '../../config/media.config.js';
import type { AppConfig } from '../../config/app.config.js';
import { PermissionsService } from '../../common/services/permissions.service.js';
import sharp from 'sharp';
// @ts-ignore - exif-reader might not have types
import exifReader from 'exif-reader';
import { fileTypeFromBuffer } from 'file-type';

interface FileUpload {
  filename: string;
  buffer: Buffer;
  mimetype: string;
}

interface SavedFileInfo {
  path: string;
  size: number;
  mimetype: string;
  type: MediaType;
  filename: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly mediaDir: string;
  private readonly thumbnailsDir: string;
  private readonly maxFileSize: number;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private permissions: PermissionsService,
  ) {
    this.mediaDir = getMediaDir();
    this.thumbnailsDir = getThumbnailsDir();
    const appConfig = this.configService.get<AppConfig>('app');
    this.maxFileSize = appConfig?.media?.maxFileSize ?? 52428800; // 50MB fallback
    this.ensureMediaDir();
    this.ensureThumbnailsDir();
  }

  private async ensureMediaDir(): Promise<void> {
    if (!existsSync(this.mediaDir)) {
      await mkdir(this.mediaDir, { recursive: true });
      this.logger.log(`Created media directory: ${this.mediaDir}`);
    }
  }

  private async ensureThumbnailsDir(): Promise<void> {
    if (!existsSync(this.thumbnailsDir)) {
      await mkdir(this.thumbnailsDir, { recursive: true });
      this.logger.log(`Created thumbnails directory: ${this.thumbnailsDir}`);
    }
  }

  /**
   * Sanitize filename to prevent path traversal and other security issues.
   * Removes: ../, ./, ~/, ${}, and any path separators
   */
  private sanitizeFilename(filename: string): string {
    // Remove path separators, parent directory references, home directory, and variable substitutions
    let sanitized = filename
      .replace(/\.\./g, '') // Remove ..
      .replace(/\//g, '') // Remove /
      .replace(/\\/g, '') // Remove \
      .replace(/~/g, '') // Remove ~
      .replace(/\${.*?}/g, '') // Remove ${...}
      .replace(/[<>:"|?*]/g, ''); // Remove invalid filename chars

    // Allow only safe characters: alphanumeric, dash, underscore, dot
    sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '_');

    // Ensure filename is not empty
    if (!sanitized || sanitized.length === 0) {
      sanitized = 'file';
    }

    // Limit length
    if (sanitized.length > 255) {
      const ext = sanitized.substring(sanitized.lastIndexOf('.'));
      sanitized = sanitized.substring(0, 250 - ext.length) + ext;
    }

    return sanitized;
  }

  /**
   * Get file extension from filename.
   */
  private getFileExtension(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    // Validate extension is safe
    if (!ext || ext.length > 10) {
      return 'bin';
    }
    return ext.replace(/[^a-z0-9]/g, '');
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
   * Determine MediaType and final MimeType based on provided info and content.
   */
  private async detectMediaInfo(
    bufferOrStream: Buffer | Readable,
    originalMime?: string,
    filename?: string,
  ): Promise<{ type: MediaType; mimeType: string }> {
    let detectedMime = originalMime;

    // Detect from buffer/stream if possible
    if (Buffer.isBuffer(bufferOrStream)) {
      const fileType = await fileTypeFromBuffer(bufferOrStream);
      if (fileType) detectedMime = fileType.mime;
    } else {
      // For streams, we could read the first chunk, but for now we rely on originalMime
      // as reading from stream consumes it.
    }

    const mime = (detectedMime || 'application/octet-stream').toLowerCase();
    let type: MediaType = MediaType.DOCUMENT;

    if (mime.startsWith('image/')) type = MediaType.IMAGE;
    else if (mime.startsWith('video/')) type = MediaType.VIDEO;
    else if (mime.startsWith('audio/')) type = MediaType.AUDIO;

    // Extension fallback for documents
    if (type === MediaType.DOCUMENT && filename) {
      const ext = this.getFileExtension(filename);
      const imageExtensions = [
        'jpg',
        'jpeg',
        'png',
        'gif',
        'webp',
        'tiff',
        'tif',
        'heic',
        'avif',
        'bmp',
        'svg',
      ];
      const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'flv', 'm4v'];
      const audioExtensions = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'wma'];

      if (imageExtensions.includes(ext)) type = MediaType.IMAGE;
      else if (videoExtensions.includes(ext)) type = MediaType.VIDEO;
      else if (audioExtensions.includes(ext)) type = MediaType.AUDIO;
    }

    return { type, mimeType: mime };
  }

  /**
   * Validate MIME types and prevent executable uploads.
   */
  private validateMimeType(mimetype: string, filename: string): void {
    const lowerMime = mimetype.toLowerCase();

    // Explicit blocklist for executable and dangerous types
    const blockedMimeTypes = [
      'application/x-msdownload',
      'application/x-sh',
      'application/x-executable',
      'application/javascript',
      'application/x-javascript',
      'text/javascript',
      'application/x-php',
      'text/x-php',
      'application/x-python',
      'text/x-python',
      'application/x-perl',
      'text/x-perl',
      'application/x-ruby',
      'text/x-ruby',
    ];

    if (blockedMimeTypes.includes(lowerMime)) {
      throw new BadRequestException('Executable or script files are not allowed');
    }

    // Explicit blocklist for extensions
    const ext = filename.split('.').pop()?.toLowerCase();
    const blockedExtensions = [
      'exe',
      'sh',
      'bat',
      'cmd',
      'msi',
      'php',
      'pl',
      'py',
      'rb',
      'js',
      'vbs',
      'bin',
      'dll',
    ];

    if (ext && blockedExtensions.includes(ext)) {
      throw new BadRequestException('Executable or script file extensions are not allowed');
    }

    // Validate type consistency
    const mime = lowerMime || 'application/octet-stream';
    let inferredType: MediaType = MediaType.DOCUMENT;
    if (mime.startsWith('image/')) inferredType = MediaType.IMAGE;
    else if (mime.startsWith('video/')) inferredType = MediaType.VIDEO;
    else if (mime.startsWith('audio/')) inferredType = MediaType.AUDIO;

    // For specific types, ensure mimetype matches
    if (lowerMime.startsWith('image/') && inferredType !== MediaType.IMAGE) {
      // Should not happen with getMediaType logic, but for clarity
    }

    // For documents, we allow almost anything not blocked
  }

  async create(data: CreateMediaDto): Promise<Omit<Media, 'meta'> & { meta: Record<string, any> }> {
    this.logger.debug(`Creating media record: type=${data.type}, storageType=${data.storageType}`);

    // Additional validation for URL/Telegram created media?
    // Not strictly needed for blocking execution unless we download it, but good to have
    if (data.mimeType) {
      // Filename might be optional, use storagePath if not present
      const filenameToCheck = data.filename || basename(data.storagePath);
      this.validateMimeType(data.mimeType, filenameToCheck);
    }

    const { meta, ...rest } = data;

    const created = await this.prisma.media.create({
      data: {
        ...rest,
        meta: (meta || {}) as any,
      },
    });

    this.logger.debug(`Created media record in DB: id=${created.id}, meta=${created.meta}`);

    return {
      ...created,
      meta: this.parseMeta(created.meta),
    };
  }

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

      // Filter media that is linked to publications in these projects
      // We also include orphaned media (not linked to any publication) for now,
      // as it might have been just uploaded.
      // If we want to be strict, we'd only show media from these projects.
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

  async remove(id: string): Promise<Media> {
    const media = await this.prisma.media.findUnique({ where: { id } });
    if (!media) {
      this.logger.warn(`Media not found for deletion: ${id}`);
      throw new NotFoundException(`Media with ID ${id} not found`);
    }

    // Use transaction to ensure both DB and file deletion
    try {
      const deleted = await this.prisma.$transaction(async tx => {
        // Delete the database record first
        const deletedMedia = await tx.media.delete({ where: { id } });

        // If it's a local file, delete it from filesystem
        if (media.storageType === StorageType.FS) {
          try {
            // Normalize and validate path to prevent traversal
            const safePath = normalize(join(this.mediaDir, media.storagePath));
            if (!safePath.startsWith(this.mediaDir)) {
              this.logger.error(`Path traversal attempt detected: ${media.storagePath}`);
              throw new Error('Invalid file path');
            }

            if (existsSync(safePath)) {
              await unlink(safePath);
              this.logger.log(`Deleted file: ${safePath}`);
            } else {
              this.logger.warn(`File not found during deletion: ${safePath}`);
            }

            // Also delete any existing thumbnails
            try {
              const files = await fs.promises.readdir(this.thumbnailsDir);
              const relatedThumbnails = files.filter((f: string) => f.startsWith(`${media.id}_`));
              for (const thumb of relatedThumbnails) {
                await unlink(join(this.thumbnailsDir, thumb));
                this.logger.debug(`Deleted thumbnail: ${thumb}`);
              }
            } catch (e) {
              this.logger.error(
                `Failed to clean up thumbnails for media ${id}: ${(e as Error).message}`,
              );
            }
          } catch (e) {
            this.logger.error(`Failed to delete file for media ${id}: ${(e as Error).message}`);
            // Don't throw - DB record is already deleted
          }
        }

        return deletedMedia;
      });

      this.logger.log(`Media deleted: ${id}`);
      return deleted;
    } catch (error) {
      this.logger.error(`Failed to delete media ${id}: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Save uploaded file to filesystem.
   */
  async saveFile(file: FileUpload): Promise<SavedFileInfo> {
    // Validate file size
    if (file.buffer.length > this.maxFileSize) {
      this.logger.warn(`File too large: ${file.buffer.length} bytes (max: ${this.maxFileSize})`);
      throw new BadRequestException(
        `File size exceeds limit of ${Math.round(this.maxFileSize / 1024 / 1024)}MB`,
      );
    }

    // Validate MIME type and Security
    this.validateMimeType(file.mimetype, file.filename);

    const date = new Date();
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const subfolder = join(year, month);
    const fullDir = join(this.mediaDir, subfolder);

    await mkdir(fullDir, { recursive: true });

    // Sanitize filename and get extension
    const sanitizedOriginalName = this.sanitizeFilename(file.filename);
    const ext = this.getFileExtension(sanitizedOriginalName);

    const uniqueFilename = `${randomUUID()}.${ext}`;
    const relativePath = join(subfolder, uniqueFilename);
    const filePath = join(fullDir, uniqueFilename);

    // Validate final path doesn't escape mediaDir
    const normalizedPath = normalize(filePath);
    if (!normalizedPath.startsWith(this.mediaDir)) {
      this.logger.error(`Path traversal attempt: ${filePath}`);
      throw new BadRequestException('Invalid file path');
    }

    await writeFile(filePath, file.buffer);

    // Detect media info using unified logic
    const { type, mimeType: finalMimeType } = await this.detectMediaInfo(
      file.buffer,
      file.mimetype,
      sanitizedOriginalName,
    );

    // Extract metadata if it's an image
    let metadata: Record<string, any> | undefined;
    if (type === MediaType.IMAGE) {
      try {
        const baseMetadata = await this.extractImageMetadata(file.buffer);
        const exif = await this.extractFullExif(file.buffer);
        metadata = {
          ...baseMetadata,
          exif,
        };
      } catch (e) {
        this.logger.error(
          `Failed to extract metadata/EXIF for ${file.filename}: ${(e as Error).message}`,
        );
      }
    }

    this.logger.log(`File saved: ${relativePath} (${file.buffer.length} bytes, type: ${type})`);

    return {
      path: relativePath,
      size: file.buffer.length,
      mimetype: finalMimeType,
      type,
      filename: sanitizedOriginalName,
      metadata,
    };
  }

  /**
   * Save a stream to the filesystem.
   */
  private async saveStream(
    stream: Readable,
    filename: string,
    mimetype: string,
  ): Promise<SavedFileInfo> {
    const sanitizedOriginalName = this.sanitizeFilename(filename);
    const ext = this.getFileExtension(sanitizedOriginalName);

    const date = new Date();
    const subfolder = join(
      date.getFullYear().toString(),
      (date.getMonth() + 1).toString().padStart(2, '0'),
    );
    const fullDir = join(this.mediaDir, subfolder);
    await mkdir(fullDir, { recursive: true });

    const uniqueFilename = `${randomUUID()}.${ext}`;
    const relativePath = join(subfolder, uniqueFilename);
    const filePath = join(fullDir, uniqueFilename);

    // Write stream to file
    const fileStream = fs.createWriteStream(filePath);
    let size = 0;

    await new Promise<void>((resolve, reject) => {
      stream.on('data', chunk => {
        size += chunk.length;
        if (size > this.maxFileSize) {
          fileStream.destroy();
          reject(new BadRequestException(`File exceeds size limit`));
        }
      });
      stream.pipe(fileStream);
      fileStream.on('finish', resolve);
      fileStream.on('error', reject);
    });

    // Detect media info (since we don't have the buffer now, we rely on mimetype and filename)
    // In future, we could have read the first chunk for better detection.
    const { type, mimeType: finalMimeType } = await this.detectMediaInfo(
      stream,
      mimetype,
      sanitizedOriginalName,
    );

    // If it's an image, we have to read it back to get metadata since we streamed it
    let metadata: Record<string, any> | undefined;
    if (type === MediaType.IMAGE) {
      try {
        const buffer = await readFile(filePath);
        const baseMetadata = await this.extractImageMetadata(buffer);
        const exif = await this.extractFullExif(buffer);
        metadata = {
          ...baseMetadata,
          exif,
        };
      } catch (e) {
        this.logger.error(
          `Failed to extract metadata and EXIF for ${filename} after stream: ${(e as Error).message}`,
        );
      }
    }

    return {
      path: relativePath,
      size,
      mimetype: finalMimeType,
      type,
      filename: sanitizedOriginalName,
      metadata,
    };
  }

  /**
   * Extract basic image metadata using sharp.
   */
  private async extractImageMetadata(buffer: Buffer): Promise<Record<string, any>> {
    try {
      const image = sharp(buffer);
      const metadata = await image.metadata();

      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        orientation: metadata.orientation,
      };
    } catch (error) {
      this.logger.error(`Error in extractImageMetadata: ${(error as Error).message}`);
      return {}; // Return empty if failed instead of throwing to allow save to continue
    }
  }

  /**
   * Internal helper to extract full EXIF from a buffer.
   */
  private async extractFullExif(buffer: Buffer): Promise<Record<string, any>> {
    try {
      const image = sharp(buffer);
      const metadata = await image.metadata();

      if (!metadata.exif) {
        return {};
      }

      // Handle potential ESM/CJS interop issues with exif-reader
      let reader = exifReader as any;
      if (typeof reader !== 'function' && typeof reader.default === 'function') {
        reader = reader.default;
      }

      if (typeof reader === 'function') {
        try {
          const exif = reader(metadata.exif);
          if (!exif || Object.keys(exif).length === 0) {
            return {};
          }

          // Normalize buffers in EXIF to prevent issues with JSON serialization
          return this.normalizeExif(exif);
        } catch (parseError) {
          this.logger.error(`exif-reader failed to parse buffer: ${(parseError as Error).message}`);
          return { _error: 'Failed to parse EXIF buffer', _details: (parseError as Error).message };
        }
      }

      return { _error: 'EXIF parser not available' };
    } catch (e) {
      this.logger.error(`Failed to extract EXIF from buffer: ${(e as Error).message}`);
      return { _error: (e as Error).message };
    }
  }

  /**
   * Recursively convert Buffers in EXIF data to serializable formats.
   */
  private normalizeExif(data: any): any {
    if (data === null || data === undefined) return data;

    // Handle Buffers
    if (Buffer.isBuffer(data)) {
      // Small buffers (like some metadata tags) can be converted to string or hex
      if (data.length < 32) {
        // Try to see if it's a string
        const str = data.toString('utf8');
        if (/^[\x20-\x7E]*$/.test(str)) return str;
        return `0x${data.toString('hex')}`;
      }
      // Medium buffers - Base64
      if (data.length < 1024) {
        return `base64:${data.toString('base64')}`;
      }
      // Large buffers - just info
      return `Buffer(${data.length} bytes)`;
    }

    // Handle Dates - VERY IMPORTANT: Object.entries(Date) is empty!
    if (data instanceof Date) {
      return data.toISOString();
    }

    // Handle Arrays
    if (Array.isArray(data)) {
      return data.map(item => this.normalizeExif(item));
    }

    // Handle Objects
    if (typeof data === 'object') {
      // Check if it's a plain object or something we can iterate
      const result: any = {};
      let hasKeys = false;
      for (const [key, value] of Object.entries(data)) {
        result[key] = this.normalizeExif(value);
        hasKeys = true;
      }
      // If it's an object but has no keys (and not a Date/Buffer), maybe it's some other class?
      if (!hasKeys && data.toString) {
        const str = data.toString();
        if (str !== '[object Object]') return str;
      }
      return result;
    }

    return data;
  }

  /**
   * Download file from URL and save to filesystem.
   */
  async downloadAndSaveFromUrl(
    url: string,
    filename?: string,
  ): Promise<SavedFileInfo & { originalUrl: string }> {
    this.logger.debug(`Downloading file from URL: ${url}`);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new BadRequestException(`Failed to download (status: ${response.status})`);
      }

      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      const contentLength = response.headers.get('content-length');

      if (contentLength && parseInt(contentLength) > this.maxFileSize) {
        throw new BadRequestException(`File too large (${contentLength} bytes)`);
      }

      if (!response.body) {
        throw new BadRequestException('Empty response body');
      }

      // Convert Web Stream to Node Stream
      const nodeStream = Readable.fromWeb(response.body as any);

      // Determine filename
      let finalFilename = filename;
      if (!finalFilename) {
        try {
          finalFilename = basename(new URL(url).pathname) || 'download';
        } catch {
          finalFilename = 'download';
        }
      }

      // Save using stream helper
      const savedFileInfo = await this.saveStream(nodeStream, finalFilename, contentType);

      this.logger.log(`File downloaded via streaming: ${url}`);

      return {
        ...savedFileInfo,
        originalUrl: url,
      };
    } catch (error) {
      this.logger.error(`Download failed for ${url}: ${(error as Error).message}`);
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(`Download failed: ${(error as Error).message}`);
    }
  }

  /**
   * Check if user interacts with media.
   * If media is linked to a project (via publication), user must have access to that project.
   * If media is orphaned (not linked to any publication), it is considered accessible to any authenticated user (or we could restrict to creator).
   */
  public async checkMediaAccess(mediaId: string, userId: string): Promise<void> {
    // Fetch media with its publication associations
    const media = await this.prisma.media.findUnique({
      where: { id: mediaId },
      include: {
        publicationMedia: {
          include: {
            publication: {
              select: { projectId: true },
            },
          },
        },
      },
    });

    if (!media) {
      throw new NotFoundException('Media not found');
    }

    // If media is not attached to any publication, we skip project check (orphaned media)
    // We could add a check if user == creator if we had createdBy field, but we don't.
    if (!media.publicationMedia || media.publicationMedia.length === 0) {
      return;
    }

    // Collect unique project IDs
    const projectIds = new Set<string>();
    for (const pm of media.publicationMedia) {
      if (pm.publication?.projectId) {
        projectIds.add(pm.publication.projectId);
      }
    }

    if (projectIds.size === 0) {
      return;
    }

    // Check access for each project
    // If user has access to AT LEAST ONE project where this media is used, allow access.
    let hasAccess = false;
    for (const projectId of projectIds) {
      try {
        await this.permissions.checkProjectAccess(projectId, userId);
        hasAccess = true;
        break; // Found one valid project
      } catch (e) {
        // Access denied for this project, checking next
      }
    }

    if (!hasAccess) {
      throw new ForbiddenException('You do not have permission to access this media file');
    }
  }

  /**
   * Stream media file to response based on source type.
   */
  async streamMediaFile(
    id: string,
    res: ServerResponse,
    userId?: string,
    range?: string,
  ): Promise<void> {
    // Check access first
    if (userId) {
      await this.checkMediaAccess(id, userId);
    }

    const media = await this.prisma.media.findUnique({ where: { id } });
    if (!media) {
      this.logger.warn(`Media not found for streaming: ${id}`);
      throw new NotFoundException('Media file not found');
    }

    try {
      this.logger.debug(
        `Streaming media: ${id}, storageType: ${media.storageType}, range: ${range || 'none'}`,
      );

      switch (media.storageType) {
        case StorageType.FS:
          await this.streamFromFileSystem(media, res, range);
          break;
        case StorageType.TELEGRAM:
          await this.streamFromTelegram(media, res);
          break;
        default:
          this.logger.error(`Unsupported storage type: ${media.storageType}`);
          throw new NotFoundException('Unsupported media storage type');
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to stream media ${id}: ${err.message}`, err.stack);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new NotFoundException(`Media file unavailable: ${err.message}`);
    }
  }

  /**
   * Stream file from local filesystem.
   */
  private async streamFromFileSystem(
    media: Media,
    res: ServerResponse,
    range?: string,
  ): Promise<void> {
    // Normalize and validate path to prevent traversal
    const safePath = normalize(join(this.mediaDir, media.storagePath));
    if (!safePath.startsWith(this.mediaDir)) {
      this.logger.error(`Path traversal attempt in streamFromFileSystem: ${media.storagePath}`);
      throw new BadRequestException('Invalid file path');
    }

    if (!existsSync(safePath)) {
      this.logger.error(`File not found: ${safePath}`);
      throw new NotFoundException('Media file not found on disk');
    }

    const fileStat = await stat(safePath);
    const fileSize = fileStat.size;

    // Set basic headers
    res.setHeader('Accept-Ranges', 'bytes');
    if (media.mimeType) {
      res.setHeader('Content-Type', media.mimeType);
    }

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        res.statusCode = 416; // Range Not Satisfiable
        res.setHeader('Content-Range', `bytes */${fileSize}`);
        res.end();
        return;
      }

      const chunksize = end - start + 1;
      res.statusCode = 206; // Partial Content
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Content-Length', chunksize);

      return new Promise((resolve, reject) => {
        const fileStream = createReadStream(safePath, { start, end });
        fileStream.pipe(res);
        fileStream.on('end', () => resolve());
        fileStream.on('error', err => {
          this.logger.error(`Stream error (range) for ${safePath}: ${err.message}`);
          reject(err);
        });
      });
    } else {
      res.setHeader('Content-Length', fileSize);
      return new Promise((resolve, reject) => {
        const fileStream = createReadStream(safePath);
        fileStream.pipe(res);
        fileStream.on('end', () => resolve());
        fileStream.on('error', err => {
          this.logger.error(`Stream error for ${safePath}: ${err.message}`);
          reject(err);
        });
      });
    }
  }

  /**
   * Stream file from Telegram using Bot API.
   * The storagePath contains the Telegram file_id.
   */
  private async streamFromTelegram(media: Media, res: ServerResponse): Promise<void> {
    const telegramBotToken = this.configService.get<string>('app.telegramBotToken');

    if (!telegramBotToken) {
      this.logger.error('Telegram bot token not configured in app config');
      throw new NotFoundException('Telegram media unavailable: bot token not configured');
    }

    try {
      // Step 1: Get file path from Telegram
      const getFileUrl = `https://api.telegram.org/bot${telegramBotToken}/getFile?file_id=${encodeURIComponent(media.storagePath)}`;

      const getFileResponse = await fetch(getFileUrl, {
        signal: AbortSignal.timeout(10000),
      });

      if (!getFileResponse.ok) {
        const errorBody = await getFileResponse.text();
        this.logger.warn(
          `Telegram getFile failed with status ${getFileResponse.status}: ${errorBody}`,
        );
        throw new Error(`Failed to get file info (status ${getFileResponse.status})`);
      }

      const fileInfo = await getFileResponse.json();

      if (!fileInfo.ok || !fileInfo.result?.file_path) {
        this.logger.warn(`Invalid Telegram file_id or file not found: ${media.storagePath}`);
        throw new Error('Invalid file_id or file not found');
      }

      // Step 2: Download file from Telegram
      const fileUrl = `https://api.telegram.org/file/bot${telegramBotToken}/${fileInfo.result.file_path}`;

      const fileResponse = await fetch(fileUrl, {
        signal: AbortSignal.timeout(60000),
      });

      if (!fileResponse.ok) {
        this.logger.warn(`Telegram file download failed with status ${fileResponse.status}`);
        throw new Error(`Failed to download file (status ${fileResponse.status})`);
      }

      // Set content type from database or response
      const contentType = media.mimeType || fileResponse.headers.get('content-type');
      if (contentType) {
        res.setHeader('Content-Type', contentType);
      }

      // Set content length if available
      const contentLength = fileResponse.headers.get('content-length');
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }

      // Stream file to client
      if (fileResponse.body) {
        // @ts-ignore
        const reader = Readable.fromWeb(fileResponse.body);
        reader.pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      const err = error as Error;
      const isConnectionError =
        err.message.includes('fetch') ||
        err.name === 'TimeoutError' ||
        err.message.includes('ETIMEDOUT');

      if (isConnectionError) {
        this.logger.error(
          `Connection error fetching Telegram file ${media.storagePath}: ${err.message}`,
          err.stack,
        );
      } else {
        this.logger.error(`Failed to fetch Telegram file ${media.storagePath}: ${err.message}`);
      }

      throw new NotFoundException(`Telegram media unavailable: ${err.message}`);
    }
  }

  /**
   * Get thumbnail path for a media file.
   * Formats: {mediaId}_{width}x{height}.webp
   */
  private getThumbnailPath(mediaId: string, width: number, height: number): string {
    return join(this.thumbnailsDir, `${mediaId}_${width}x${height}.webp`);
  }

  /**
   * Generate thumbnail on demand.
   */
  async generateThumbnail(mediaId: string, width: number, height: number): Promise<string> {
    const media = await this.prisma.media.findUnique({ where: { id: mediaId } });
    if (!media) throw new NotFoundException('Media not found');
    if (media.type !== MediaType.IMAGE && media.type !== MediaType.VIDEO) {
      throw new BadRequestException('Thumbnails are only supported for images and videos');
    }

    const thumbPath = this.getThumbnailPath(mediaId, width, height);

    // Check if already exists
    if (existsSync(thumbPath)) {
      return thumbPath;
    }

    // For now, support only local FS images.
    // In future, for Telegram we could download first, but it's expensive.
    if (media.storageType !== StorageType.FS) {
      throw new BadRequestException(
        'Thumbnails currently supported only for local filesystem storage',
      );
    }

    const safePath = normalize(join(this.mediaDir, media.storagePath));
    if (!safePath.startsWith(this.mediaDir) || !existsSync(safePath)) {
      throw new NotFoundException('Source file not found');
    }

    try {
      this.logger.debug(`Generating thumbnail ${width}x${height} for ${mediaId}`);
      await sharp(safePath)
        .resize(width, height, {
          fit: 'cover',
          withoutEnlargement: true,
        })
        .webp({ quality: 80 })
        .toFile(thumbPath);

      return thumbPath;
    } catch (error) {
      this.logger.error(`Failed to generate thumbnail for ${mediaId}: ${(error as Error).message}`);
      throw new BadRequestException(`Failed to generate thumbnail: ${(error as Error).message}`);
    }
  }

  /**
   * Stream thumbnail to response.
   */
  async streamThumbnail(id: string, res: ServerResponse, width = 400, height = 400): Promise<void> {
    try {
      const thumbPath = await this.generateThumbnail(id, width, height);

      const fileStat = await stat(thumbPath);
      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('Content-Length', fileStat.size);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

      return new Promise((resolve, reject) => {
        const stream = createReadStream(thumbPath);
        stream.pipe(res);
        stream.on('end', resolve);
        stream.on('error', reject);
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error streaming thumbnail for ${id}: ${(error as Error).message}`);
      throw new NotFoundException('Thumbnail unavailable');
    }
  }
}
