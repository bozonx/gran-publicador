import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join, normalize, basename } from 'path';
import { mkdir, writeFile, unlink } from 'fs/promises';
import { createReadStream, existsSync } from 'fs';
import { randomUUID } from 'crypto';
import { request } from 'undici';
import type { ServerResponse } from 'http';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateMediaDto, CreateMediaGroupDto, UpdateMediaDto } from './dto/index.js';
import { MediaType, MediaSourceType, Media } from '../../generated/prisma/client.js';
import { getMediaDir } from '../../config/media.config.js';
import type { AppConfig } from '../../config/app.config.js';
import { PermissionsService } from '../../common/services/permissions.service.js';

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
    this.logger.debug(`Creating media record: type=${data.type}, srcType=${data.srcType}`);
    
    // Additional validation for URL/Telegram created media?
    // Not strictly needed for blocking execution unless we download it, but good to have
    if (data.mimeType) {
        // Filename might be optional, use src if not present
        const filenameToCheck = data.filename || basename(data.src);
        this.validateMimeType(data.mimeType, filenameToCheck);
    }
    
    const { meta, ...rest } = data;

    const created = await this.prisma.media.create({
      data: {
        ...rest,
        meta: JSON.stringify(meta || {}),
      },
    });
    
    return {
      ...created,
      meta: meta || {},
    };
  }

  async findAll(): Promise<Media[]> {
    return this.prisma.media.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(id: string): Promise<Omit<Media, 'meta'> & { meta: Record<string, any> }> {
    const media = await this.prisma.media.findUnique({ where: { id } });
    if (!media) {
      this.logger.warn(`Media not found: ${id}`);
      throw new NotFoundException(`Media with ID ${id} not found`);
    }
    return {
      ...media,
      meta: JSON.parse(media.meta) as Record<string, any>,
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
      meta: JSON.parse(updated.meta) as Record<string, any>,
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
        if (media.srcType === MediaSourceType.FS) {
          try {
            // Normalize and validate path to prevent traversal
            const safePath = normalize(join(this.mediaDir, media.src));
            if (!safePath.startsWith(this.mediaDir)) {
              this.logger.error(`Path traversal attempt detected: ${media.src}`);
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

    const type = this.getMediaType(file.mimetype);
    
    this.logger.log(`File saved: ${relativePath} (${file.buffer.length} bytes, type: ${type})`);

    return {
      path: relativePath,
      size: file.buffer.length,
      mimetype: file.mimetype,
      type,
      filename: sanitizedOriginalName
    };
  }

  /**
   * Download file from URL and save to filesystem.
   */
  async downloadAndSaveFromUrl(url: string, filename?: string): Promise<SavedFileInfo & { originalUrl: string }> {
    this.logger.debug(`Downloading file from URL: ${url}`);

    try {
      // Download file from URL
      const response = await request(url, {
        method: 'GET',
      });

      if (response.statusCode !== 200) {
        this.logger.warn(`URL returned status ${response.statusCode}: ${url}`);
        throw new BadRequestException(`Failed to download file from URL (status: ${response.statusCode})`);
      }

      // Get content type and length
      const contentType = response.headers['content-type'] as string || 'application/octet-stream';
      const contentLength = response.headers['content-length'];

      // Check file size before downloading
      if (contentLength && parseInt(contentLength as string) > this.maxFileSize) {
        throw new BadRequestException(
          `File size exceeds limit of ${Math.round(this.maxFileSize / 1024 / 1024)}MB`
        );
      }

      // Download file to buffer
      const chunks: Buffer[] = [];
      let totalSize = 0;

      for await (const chunk of response.body) {
        chunks.push(chunk as Buffer);
        totalSize += (chunk as Buffer).length;

        // Check size during download
        if (totalSize > this.maxFileSize) {
          throw new BadRequestException(
            `File size exceeds limit of ${Math.round(this.maxFileSize / 1024 / 1024)}MB`
          );
        }
      }

      const buffer = Buffer.concat(chunks);

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
   * Create media group.
   */
  async createGroup(data: CreateMediaGroupDto) {
    this.logger.debug(`Creating media group: ${data.name || 'unnamed'}`);
    
    return this.prisma.mediaGroup.create({
      data: {
        name: data.name,
        description: data.description,
        items: {
          create: data.items.map(item => ({
            media: { connect: { id: item.mediaId } },
            order: item.order ?? 0
          }))
        }
      },
      include: {
        items: {
          include: { media: true },
          orderBy: { order: 'asc' }
        }
      }
    });
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
  async streamMediaFile(id: string, res: ServerResponse, userId?: string): Promise<void> {
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
      this.logger.debug(`Streaming media: ${id}, srcType: ${media.srcType}`);

      switch (media.srcType) {
        case MediaSourceType.FS:
          await this.streamFromFileSystem(media, res);
          break;
        case MediaSourceType.URL:
          await this.streamFromUrl(media, res);
          break;
        case MediaSourceType.TELEGRAM:
          await this.streamFromTelegram(media, res);
          break;
        default:
          this.logger.error(`Unsupported source type: ${media.srcType}`);
          throw new NotFoundException('Unsupported media source type');
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to stream media ${id}: ${err.message}`);
      if (error instanceof NotFoundException || error instanceof BadRequestException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new NotFoundException('Media file unavailable');
    }
  }

  /**
   * Stream file from local filesystem.
   */
  private async streamFromFileSystem(media: Media, res: ServerResponse): Promise<void> {
    // Normalize and validate path to prevent traversal
    const safePath = normalize(join(this.mediaDir, media.src));
    if (!safePath.startsWith(this.mediaDir)) {
      this.logger.error(`Path traversal attempt in streamFromFileSystem: ${media.src}`);
      throw new BadRequestException('Invalid file path');
    }

    if (!existsSync(safePath)) {
      this.logger.error(`File not found: ${safePath}`);
      throw new NotFoundException('Media file not found on disk');
    }

    // Set content type from database
    if (media.mimeType) {
      res.setHeader('Content-Type', media.mimeType);
    }

    // Set content length if available
    if (media.sizeBytes) {
      res.setHeader('Content-Length', media.sizeBytes);
    }

    // Stream file to response
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

  /**
   * Proxy stream from external URL.
   */
  private async streamFromUrl(media: Media, res: ServerResponse): Promise<void> {
    try {
      const response = await request(media.src, {
        method: 'GET',
      });

      if (response.statusCode !== 200) {
        this.logger.warn(`URL returned status ${response.statusCode}: ${media.src}`);
        throw new NotFoundException('Media file unavailable from URL');
      }

      // Forward content-type from source
      const contentType = response.headers['content-type'];
      if (contentType) {
        res.setHeader('Content-Type', contentType);
      }

      // Forward content-length if available
      const contentLength = response.headers['content-length'];
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }

      // Stream response body to client
      response.body.pipe(res);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to fetch URL ${media.src}: ${err.message}`);
      throw new NotFoundException('Media file unavailable from URL');
    }
  }

  /**
   * Stream file from Telegram using Bot API.
   */
  private async streamFromTelegram(media: Media, res: ServerResponse): Promise<void> {
    const telegramBotToken = this.configService.get<string>('app.telegramBotToken');

    if (!telegramBotToken) {
      this.logger.error('Telegram bot token not configured');
      throw new NotFoundException('Telegram media unavailable');
    }

    try {
      // Step 1: Get file path from Telegram
      const getFileUrl = `https://api.telegram.org/bot${telegramBotToken}/getFile?file_id=${encodeURIComponent(media.src)}`;
      const getFileResponse = await request(getFileUrl, { method: 'GET' });

      if (getFileResponse.statusCode !== 200) {
        this.logger.warn(`Telegram getFile failed with status ${getFileResponse.statusCode}`);
        throw new Error('Failed to get file info from Telegram');
      }

      const fileInfo = await getFileResponse.body.json() as any;

      if (!fileInfo.ok || !fileInfo.result?.file_path) {
        this.logger.warn(`Invalid Telegram file_id or file not found: ${media.src}`);
        throw new Error('Invalid file_id or file not found');
      }

      // Step 2: Download file from Telegram
      const fileUrl = `https://api.telegram.org/file/bot${telegramBotToken}/${fileInfo.result.file_path}`;
      const fileResponse = await request(fileUrl, { method: 'GET' });

      if (fileResponse.statusCode !== 200) {
        this.logger.warn(`Telegram file download failed with status ${fileResponse.statusCode}`);
        throw new Error('Failed to download file from Telegram');
      }

      // Set content type from database or response
      const contentType = media.mimeType || fileResponse.headers['content-type'];
      if (contentType) {
        res.setHeader('Content-Type', contentType);
      }

      // Set content length if available
      const contentLength = fileResponse.headers['content-length'];
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }

      // Stream file to client
      fileResponse.body.pipe(res);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to fetch Telegram file ${media.src}: ${err.message}`);
      throw new NotFoundException('Telegram media unavailable');
    }
  }

  async findGroup(id: string) {
    const group = await this.prisma.mediaGroup.findUnique({
      where: { id },
      include: {
        items: {
          include: { media: true },
          orderBy: { order: 'asc' }
        }
      }
    });
    if (!group) {
      this.logger.warn(`Media group not found: ${id}`);
      throw new NotFoundException(`MediaGroup with ID ${id} not found`);
    }
    return group;
  }
}
