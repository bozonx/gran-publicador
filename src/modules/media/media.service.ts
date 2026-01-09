import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join, normalize, basename } from 'path';
import { mkdir, writeFile, unlink, stat } from 'fs/promises';
import { Readable } from 'stream';
import { createReadStream, existsSync } from 'fs';
import { randomUUID } from 'crypto';
import type { ServerResponse } from 'http';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateMediaDto, UpdateMediaDto } from './dto/index.js';
import { MediaType, StorageType, Media } from '../../generated/prisma/client.js';
import { getMediaDir } from '../../config/media.config.js';
import type { AppConfig } from '../../config/app.config.js';
import { PermissionsService } from '../../common/services/permissions.service.js';
import sharp from 'sharp';
// @ts-ignore - exif-reader might not have types
import exifReader from 'exif-reader';

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
  private readonly maxFileSize: number;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private permissions: PermissionsService,
  ) {
    this.mediaDir = getMediaDir();
    const appConfig = this.configService.get<AppConfig>('app');
    this.maxFileSize = appConfig?.media?.maxFileSize ?? 52428800; // 50MB fallback
    this.ensureMediaDir();
  }

  private async ensureMediaDir(): Promise<void> {
    if (!existsSync(this.mediaDir)) {
      await mkdir(this.mediaDir, { recursive: true });
      this.logger.log(`Created media directory: ${this.mediaDir}`);
    }
  }

  /**
   * Sanitize filename to prevent path traversal and other security issues.
   * Removes: ../, ./, ~/, ${}, and any path separators
   */
  private sanitizeFilename(filename: string): string {
    // Remove path separators, parent directory references, home directory, and variable substitutions
    let sanitized = filename
      .replace(/\.\./g, '')  // Remove ..
      .replace(/\//g, '')    // Remove /
      .replace(/\\/g, '')    // Remove \
      .replace(/~/g, '')     // Remove ~
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
   * Determine MediaType based on mimetype.
   */
  private getMediaType(mimetype: string): MediaType {
    if (mimetype.startsWith('image/')) return MediaType.IMAGE;
    if (mimetype.startsWith('video/')) return MediaType.VIDEO;
    if (mimetype.startsWith('audio/')) return MediaType.AUDIO;
    return MediaType.DOCUMENT;
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
      'exe', 'sh', 'bat', 'cmd', 'msi', 'php', 'pl', 'py', 'rb', 'js', 'vbs', 'bin', 'dll'
    ];

    if (ext && blockedExtensions.includes(ext)) {
      throw new BadRequestException('Executable or script file extensions are not allowed');
    }

    // Validate type consistency
    const inferredType = this.getMediaType(lowerMime);
    
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
        meta: JSON.stringify(meta || {}),
      },
    });
    
    this.logger.debug(`Created media record in DB: id=${created.id}, meta=${created.meta}`);
    
    return {
      ...created,
      meta: meta || {},
    };
  }

  async findAll(): Promise<Array<Omit<Media, 'meta'> & { meta: Record<string, any> }>> {
    const list = await this.prisma.media.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return list.map(media => ({
      ...media,
      meta: JSON.parse(media.meta || '{}') as Record<string, any>,
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
      meta: JSON.parse(media.meta || '{}') as Record<string, any>,
    };
  }

  async update(id: string, data: UpdateMediaDto): Promise<Omit<Media, 'meta'> & { meta: Record<string, any> }> {
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
        meta: meta ? JSON.stringify(meta) : undefined
      }
    });
    
    return {
      ...updated,
      meta: JSON.parse(updated.meta || '{}') as Record<string, any>,
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
      const deleted = await this.prisma.$transaction(async (tx) => {
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
        `File size exceeds limit of ${Math.round(this.maxFileSize / 1024 / 1024)}MB`
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

    let type = this.getMediaType(file.mimetype);

    // If detected as document but has image extension, treat as image.
    // This helps when browser sends 'application/octet-stream' or similar for images.
    if (type === MediaType.DOCUMENT) {
      const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'tiff', 'tif', 'heic', 'avif', 'bmp', 'svg'];
      if (imageExtensions.includes(ext)) {
        this.logger.debug(`Auto-detecting image type based on extension '.${ext}' for file '${file.filename}'`);
        type = MediaType.IMAGE;
      }
    }
    
    // Extract metadata if it's an image
    let metadata: Record<string, any> | undefined;
    if (type === MediaType.IMAGE) {
      try {
        metadata = await this.extractImageMetadata(file.buffer);
      } catch (e) {
        this.logger.error(`Failed to extract metadata for ${file.filename}: ${(e as Error).message}`, (e as Error).stack);
      }
    }
    
    this.logger.log(`File saved: ${relativePath} (${file.buffer.length} bytes, type: ${type})`);

    return {
      path: relativePath,
      size: file.buffer.length,
      mimetype: file.mimetype,
      type,
      filename: sanitizedOriginalName,
      metadata
    };
  }

  /**
   * Extract image metadata using sharp.
   */
  private async extractImageMetadata(buffer: Buffer): Promise<Record<string, any>> {
    try {
      // console.log(`[DEBUG] sharp versions: ${JSON.stringify(sharp.versions)}`);
      // this.logger.debug(`sharp versions: ${JSON.stringify(sharp.versions)}`);
      const image = sharp(buffer);
      const metadata = await image.metadata();
      
      // console.log(`[DEBUG] sharp metadata: width=${metadata.width}, height=${metadata.height}, format=${metadata.format}, hasExif=${!!metadata.exif}`);
      // this.logger.debug(`sharp metadata: width=${metadata.width}, height=${metadata.height}, format=${metadata.format}, hasExif=${!!metadata.exif}`);

      const result: Record<string, any> = {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        orientation: metadata.orientation,
      };

      // Extract EXIF data if present
      if (metadata.exif) {
        try {
          // Handle potential ESM/CJS interop issues with exif-reader
          let reader = exifReader as any;
          if (typeof reader !== 'function' && typeof reader.default === 'function') {
            reader = reader.default;
          }

          if (typeof reader === 'function') {
            const exif = reader(metadata.exif);
            
            if (exif) {
              if (exif.image) {
                result.orientation = exif.image.Orientation || result.orientation;
                if (exif.image.ModifyDate) {
                  result.capturedAt = exif.image.ModifyDate.toISOString();
                }
              }
              
              if (exif.exif) {
                if (exif.exif.DateTimeOriginal) {
                  result.capturedAt = exif.exif.DateTimeOriginal.toISOString();
                }
              }
              
              const gps = exif.gps || exif.GPSInfo; // Handle different casing if needed
              if (gps) {
                // Convert GPS coordinates to decimal
                const convertGps = (coords: number[], ref: string) => {
                  let decimal = coords[0] + coords[1] / 60 + coords[2] / 3600;
                  if (ref === 'S' || ref === 'W') decimal = -decimal;
                  return decimal;
                };

                if (gps.GPSLatitude && gps.GPSLatitudeRef && 
                    gps.GPSLongitude && gps.GPSLongitudeRef) {
                  result.location = {
                    lat: convertGps(gps.GPSLatitude, gps.GPSLatitudeRef),
                    lng: convertGps(gps.GPSLongitude, gps.GPSLongitudeRef)
                  };
                }
              }
            }
          } else {
             this.logger.warn(`exif-reader is not a function: ${typeof reader}`);
          }
        } catch (e) {
          this.logger.warn(`Error parsing EXIF: ${(e as Error).message}`);
        }
      }

      return result;
    } catch (error) {
       this.logger.error(`Error in extractImageMetadata: ${(error as Error).message}`);
       throw error;
    }
  }

  /**
   * Download file from URL and save to filesystem.
   */
  async downloadAndSaveFromUrl(url: string, filename?: string): Promise<SavedFileInfo & { originalUrl: string }> {
    this.logger.debug(`Downloading file from URL: ${url}`);

    try {
      // Download file from URL using global fetch
      const response = await fetch(url);

      if (!response.ok) {
        this.logger.warn(`URL returned status ${response.status}: ${url}`);
        throw new BadRequestException(`Failed to download file from URL (status: ${response.status})`);
      }

      // Get content type and length
      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      const contentLength = response.headers.get('content-length');

      // Check file size before downloading
      if (contentLength && parseInt(contentLength) > this.maxFileSize) {
        throw new BadRequestException(
          `File size exceeds limit of ${Math.round(this.maxFileSize / 1024 / 1024)}MB`
        );
      }

      // Download file to buffer
      // Note: response.arrayBuffer() is easier but loads everything in memory. 
      // Given maxFileSize is 50MB, it's acceptable.
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (buffer.length > this.maxFileSize) {
         throw new BadRequestException(
          `File size exceeds limit of ${Math.round(this.maxFileSize / 1024 / 1024)}MB`
        );
      }

      // Determine filename from URL or use provided one
      let finalFilename = filename;
      if (!finalFilename) {
        const urlPath = new URL(url).pathname;
        finalFilename = basename(urlPath) || 'download';
      }

      // Save file using existing saveFile method
      const savedFileInfo = await this.saveFile({
        filename: finalFilename,
        buffer,
        mimetype: contentType,
      });

      this.logger.log(`File downloaded and saved from URL: ${url}`);

      return {
        ...savedFileInfo,
        originalUrl: url,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to download file from URL ${url}: ${err.message}`);
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new BadRequestException(`Failed to download file from URL: ${err.message}`);
    }
  }


  /**
   * Check if user interacts with media.
   * If media is linked to a project (via publication), user must have access to that project.
   * If media is orphaned (not linked to any publication), it is considered accessible to any authenticated user (or we could restrict to creator).
   */
  private async checkMediaAccess(mediaId: string, userId: string): Promise<void> {
      // Fetch media with its publication associations
      const media = await this.prisma.media.findUnique({
          where: { id: mediaId },
          include: {
              publicationMedia: {
                  include: {
                      publication: {
                          select: { projectId: true }
                      }
                  }
              }
          }
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
  async streamMediaFile(id: string, res: ServerResponse, userId?: string, range?: string): Promise<void> {
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
      this.logger.debug(`Streaming media: ${id}, storageType: ${media.storageType}, range: ${range || 'none'}`);

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
      if (error instanceof NotFoundException || error instanceof BadRequestException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new NotFoundException(`Media file unavailable: ${err.message}`);
    }
  }

  /**
   * Stream file from local filesystem.
   */
  private async streamFromFileSystem(media: Media, res: ServerResponse, range?: string): Promise<void> {
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

      const chunksize = (end - start) + 1;
      res.statusCode = 206; // Partial Content
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Content-Length', chunksize);

      return new Promise((resolve, reject) => {
        const fileStream = createReadStream(safePath, { start, end });
        fileStream.pipe(res);
        fileStream.on('end', () => resolve());
        fileStream.on('error', (err) => {
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
        fileStream.on('error', (err) => {
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
        signal: AbortSignal.timeout(10000) 
      });

      if (!getFileResponse.ok) {
        const errorBody = await getFileResponse.text();
        this.logger.warn(`Telegram getFile failed with status ${getFileResponse.status}: ${errorBody}`);
        throw new Error(`Failed to get file info (status ${getFileResponse.status})`);
      }

      const fileInfo = await getFileResponse.json() as any;

      if (!fileInfo.ok || !fileInfo.result?.file_path) {
        this.logger.warn(`Invalid Telegram file_id or file not found: ${media.storagePath}`);
        throw new Error('Invalid file_id or file not found');
      }

      // Step 2: Download file from Telegram
      const fileUrl = `https://api.telegram.org/file/bot${telegramBotToken}/${fileInfo.result.file_path}`;
      
      const fileResponse = await fetch(fileUrl, {
         signal: AbortSignal.timeout(60000)
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
      const isConnectionError = err.message.includes('fetch') || err.name === 'TimeoutError' || err.message.includes('ETIMEDOUT');
      
      if (isConnectionError) {
         this.logger.error(`Connection error fetching Telegram file ${media.storagePath}: ${err.message}`, err.stack);
      } else {
         this.logger.error(`Failed to fetch Telegram file ${media.storagePath}: ${err.message}`);
      }
      
      throw new NotFoundException(`Telegram media unavailable: ${err.message}`);
    }
  }

}
