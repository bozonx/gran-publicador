import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  BadRequestException,
  UseGuards,
  Query,
  Logger,
} from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { MediaService } from './media.service.js';
import { CreateMediaDto, UpdateMediaDto } from './dto/index.js';
import { JwtOrApiTokenGuard } from '../../common/guards/jwt-or-api-token.guard.js';
import type { UnifiedAuthRequest } from '../../common/types/unified-auth-request.interface.js';
import { StorageType } from '../../generated/prisma/index.js';
import { getMediaTypeFromMime } from './utils/media-type.util.js';

@Controller('media')
export class MediaController {
  private readonly logger = new Logger(MediaController.name);

  constructor(private readonly mediaService: MediaService) {}

  @Post()
  @UseGuards(JwtOrApiTokenGuard)
  create(@Body() createMediaDto: CreateMediaDto) {
    return this.mediaService.create(createMediaDto);
  }

  /**
   * Upload file to Media Storage microservice.
   * Streams the file without buffering to memory.
   */
  @Post('upload')
  @UseGuards(JwtOrApiTokenGuard)
  async upload(@Req() req: UnifiedAuthRequest) {
    if (!req.isMultipart?.()) {
      throw new BadRequestException('Request is not multipart');
    }

    const part = await req.file();
    if (!part) {
      this.logger.warn('Upload attempt without file part');
      throw new BadRequestException('No file uploaded');
    }

    this.logger.debug(
      `Received upload request: filename="${part.filename}", mimetype="${part.mimetype}"`,
    );

    // Use streaming directly from fastify-multipart
    const fileStream = part.file;

    // Extract optimize parameters if present from fields that appeared before the file
    let optimize: Record<string, any> | undefined;
    const fields = (part as any).fields;

    // Helper to get field value safely
    const getFieldValue = (field: any) => field?.value;

    if (fields) {
      if (fields.optimize) {
        try {
          const optimizeValue = getFieldValue(fields.optimize);
          optimize = typeof optimizeValue === 'string' ? JSON.parse(optimizeValue) : optimizeValue;
        } catch (error) {
          this.logger.error(`Failed to parse optimize field: ${(error as any).message}`);
        }
      }

      // If optimize is not provided explicitly, try to load from project settings
      if (!optimize && fields.projectId) {
        const projectId = getFieldValue(fields.projectId);
        if (projectId) {
          try {
            optimize = await this.mediaService.getProjectOptimizationSettings(projectId);
          } catch (error) {
            this.logger.error(`Failed to load project optimization: ${(error as any).message}`);
          }
        }
      }
    }

    let fileSizeBytes: number | undefined;
    if (fields?.fileSize) {
      const value = Number.parseInt(getFieldValue(fields.fileSize), 10);
      if (Number.isFinite(value) && value > 0) {
        fileSizeBytes = value;
      }
    }

    // Upload to Media Storage using stream
    const { fileId, metadata } = await this.mediaService.uploadFileToStorage(
      fileStream,
      part.filename,
      part.mimetype,
      fileSizeBytes,
      req.user.userId,
      undefined,
      optimize,
    );

    // Create the media record with fileId from Media Storage
    return this.mediaService.create({
      type: getMediaTypeFromMime(metadata.mimeType),
      storageType: StorageType.STORAGE,
      storagePath: fileId, // Store Media Storage fileId
      filename: part.filename,
      mimeType: metadata.mimeType,
      sizeBytes: metadata.size,
      meta: metadata,
    });
  }

  /**
   * Replace an existing STORAGE media file in Media Storage.
   * Keeps the same Media ID in DB and updates metadata.
   */
  @Post(':id/replace-file')
  @UseGuards(JwtOrApiTokenGuard)
  async replaceFile(@Param('id') id: string, @Req() req: UnifiedAuthRequest) {
    if (!req.isMultipart?.()) {
      throw new BadRequestException('Request is not multipart');
    }

    const part = await req.file();
    if (!part) {
      this.logger.warn('Replace-file attempt without file part');
      throw new BadRequestException('No file uploaded');
    }

    this.logger.debug(
      `Received replace-file request: id="${id}", filename="${part.filename}", mimetype="${part.mimetype}"`,
    );

    if (!part.mimetype?.toLowerCase().startsWith('image/')) {
      throw new BadRequestException('Only image files can be used for replace-file');
    }

    const fileStream = part.file;

    let optimize: Record<string, any> | undefined;
    let projectId: string | undefined;
    let fileSizeBytes: number | undefined;
    const fields = (part as any).fields;
    const getFieldValue = (field: any) => field?.value;

    if (fields) {
      if (fields.optimize) {
        try {
          const optimizeValue = getFieldValue(fields.optimize);
          optimize = typeof optimizeValue === 'string' ? JSON.parse(optimizeValue) : optimizeValue;
        } catch (error) {
          this.logger.error(`Failed to parse optimize field: ${(error as any).message}`);
        }
      }

      if (fields.projectId) {
        projectId = getFieldValue(fields.projectId);
      }

      if (fields.fileSize) {
        const value = Number.parseInt(getFieldValue(fields.fileSize), 10);
        if (Number.isFinite(value) && value > 0) {
          fileSizeBytes = value;
        }
      }
    }

    return this.mediaService.replaceMediaFile(
      id,
      fileStream,
      part.filename,
      part.mimetype,
      req.user.userId,
      optimize,
      projectId,
      fileSizeBytes,
    );
  }

  /**
   * Upload file as raw stream (no multipart).
   * Accepts metadata via headers: x-filename, x-mime-type, x-file-size, x-project-id, x-optimize.
   * Streams the body directly to Media Storage without buffering.
   */
  @Post('upload-stream')
  @UseGuards(JwtOrApiTokenGuard)
  async uploadStream(@Req() req: UnifiedAuthRequest) {
    const filename = req.headers['x-filename'] as string | undefined;
    const mimetype =
      (req.headers['x-mime-type'] as string | undefined) || 'application/octet-stream';

    if (!filename) {
      throw new BadRequestException('x-filename header is required');
    }

    const fileSizeHeader = req.headers['x-file-size'] as string | undefined;
    let fileSizeBytes: number | undefined;
    if (fileSizeHeader) {
      const parsed = Number.parseInt(fileSizeHeader, 10);
      if (Number.isFinite(parsed) && parsed > 0) fileSizeBytes = parsed;
    }

    let optimize: Record<string, any> | undefined;
    const optimizeHeader = req.headers['x-optimize'] as string | undefined;
    if (optimizeHeader) {
      try {
        optimize = JSON.parse(optimizeHeader);
      } catch {
        this.logger.warn('Failed to parse x-optimize header');
      }
    }

    const projectIdHeader = req.headers['x-project-id'] as string | undefined;
    if (!optimize && projectIdHeader) {
      try {
        optimize = await this.mediaService.getProjectOptimizationSettings(projectIdHeader);
      } catch (error) {
        this.logger.error(`Failed to load project optimization: ${(error as any).message}`);
      }
    }

    this.logger.debug(
      `Received stream upload: filename="${filename}", mimetype="${mimetype}", size=${fileSizeBytes ?? 'unknown'}`,
    );

    const { fileId, metadata } = await this.mediaService.uploadFileToStorage(
      req.raw as any,
      filename,
      mimetype,
      fileSizeBytes,
      req.user.userId,
      undefined,
      optimize,
    );

    return this.mediaService.create({
      type: getMediaTypeFromMime(metadata.mimeType),
      storageType: StorageType.STORAGE,
      storagePath: fileId,
      filename,
      mimeType: metadata.mimeType,
      sizeBytes: metadata.size,
      meta: metadata,
    });
  }

  /**
   * Upload from URL endpoint.
   * Proxies the request to Media Storage.
   */
  @Post('upload-from-url')
  @UseGuards(JwtOrApiTokenGuard)
  async uploadFromUrl(
    @Body() body: { url: string; filename?: string; optimize?: Record<string, any> },
    @Req() req: UnifiedAuthRequest,
  ) {
    if (!body.url) {
      throw new BadRequestException('URL is required');
    }

    // Upload to Media Storage via URL
    const { fileId, metadata } = await this.mediaService.uploadFileFromUrl(
      body.url,
      body.filename,
      req.user.userId,
      undefined,
      body.optimize,
    );

    // Extract filename from URL if not provided
    const filename = body.filename || this.extractFilenameFromUrl(body.url);

    // Create the media record with fileId from Media Storage
    return this.mediaService.create({
      type: getMediaTypeFromMime(metadata.mimeType),
      storageType: StorageType.FS,
      storagePath: fileId, // Store Media Storage fileId
      filename,
      mimeType: metadata.mimeType,
      sizeBytes: metadata.size,
      meta: metadata,
    });
  }

  /**
   * Extract filename from URL.
   */
  private extractFilenameFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const parts = pathname.split('/');
      const filename = parts[parts.length - 1];
      return filename || 'downloaded-file';
    } catch {
      return 'downloaded-file';
    }
  }

  @Get()
  @UseGuards(JwtOrApiTokenGuard)
  findAll(@Req() req: UnifiedAuthRequest) {
    return this.mediaService.findAll(req.user.userId);
  }

  /**
   * Stream media file.
   * For StorageType.STORAGE: proxies from Media Storage
   * For StorageType.TELEGRAM: streams from Telegram API
   */
  @Get(':id/file')
  @UseGuards(JwtOrApiTokenGuard)
  async getFile(
    @Param('id') id: string,
    @Req() req: UnifiedAuthRequest,
    @Res() res: FastifyReply,
    @Query('download') download?: string,
  ) {
    const range = req.headers.range;
    const { stream, status, headers } = await this.mediaService.getMediaFile(
      id,
      req.user.userId,
      range,
      download === '1' || download === 'true',
    );

    const requestId = (req.headers['x-request-id'] as string | undefined) ?? undefined;

    stream.once('error', err => {
      this.logger.error(
        `Media stream error: id="${id}", status=${status}, range="${range || ''}", requestId="${requestId || ''}": ${err.message}`,
      );
    });

    res.raw.once('close', () => {
      this.logger.warn(
        `Media response closed: id="${id}", status=${status}, range="${range || ''}", requestId="${requestId || ''}"`,
      );
      if (!stream.destroyed) {
        stream.destroy();
      }
    });

    res.raw.once('finish', () => {
      this.logger.debug(
        `Media response finished: id="${id}", status=${status}, range="${range || ''}", requestId="${requestId || ''}"`,
      );
    });

    res.status(status);
    res.headers(headers);
    return res.send(stream);
  }

  /**
   * Get thumbnail for media.
   * For StorageType.STORAGE: proxied from Media Storage.
   * For StorageType.TELEGRAM: proxied from Telegram API.
   */
  @Get(':id/thumbnail')
  @UseGuards(JwtOrApiTokenGuard)
  async getThumbnail(
    @Param('id') id: string,
    @Req() req: UnifiedAuthRequest,
    @Res() res: FastifyReply,
    @Query('w') widthStr?: string,
    @Query('h') heightStr?: string,
    @Query('quality') qualityStr?: string,
  ) {
    const width = widthStr ? parseInt(widthStr, 10) : 400;
    const height = heightStr ? parseInt(heightStr, 10) : 400;
    const quality = qualityStr ? parseInt(qualityStr, 10) : undefined;
    const fit = req.query instanceof Object ? (req.query as any).fit : undefined;

    const { stream, status, headers } = await this.mediaService.getMediaThumbnail(
      id,
      width,
      height,
      quality,
      req.user.userId,
      fit,
    );

    const requestId = (req.headers['x-request-id'] as string | undefined) ?? undefined;

    stream.once('error', err => {
      this.logger.error(
        `Thumbnail stream error: id="${id}", status=${status}, requestId="${requestId || ''}": ${err.message}`,
      );
    });

    res.raw.once('close', () => {
      this.logger.warn(
        `Thumbnail response closed: id="${id}", status=${status}, requestId="${requestId || ''}"`,
      );
      if (!stream.destroyed) {
        stream.destroy();
      }
    });

    res.raw.once('finish', () => {
      this.logger.debug(
        `Thumbnail response finished: id="${id}", status=${status}, requestId="${requestId || ''}"`,
      );
    });

    res.status(status);
    res.headers(headers);
    return res.send(stream);
  }

  /**
   * Get a single media item by ID.
   */
  @Get(':id')
  @UseGuards(JwtOrApiTokenGuard)
  public async findOne(@Req() req: UnifiedAuthRequest, @Param('id') id: string) {
    await this.mediaService.checkMediaAccess(id, req.user.userId);
    return this.mediaService.findOne(id);
  }

  @Get(':id/info')
  @UseGuards(JwtOrApiTokenGuard)
  public async getInfo(@Req() req: UnifiedAuthRequest, @Param('id') id: string) {
    await this.mediaService.checkMediaAccess(id, req.user.userId);
    const media = await this.mediaService.findOne(id);
    if (media.storageType !== StorageType.STORAGE) {
      throw new BadRequestException('Only STORAGE media has extended info');
    }
    return this.mediaService.getFileInfo(media.storagePath);
  }

  @Patch(':id')
  @UseGuards(JwtOrApiTokenGuard)
  async update(
    @Param('id') id: string,
    @Body() updateMediaDto: UpdateMediaDto,
    @Req() req: UnifiedAuthRequest,
  ) {
    await this.mediaService.checkMediaAccess(id, req.user.userId);
    return this.mediaService.update(id, updateMediaDto);
  }

  @Delete(':id')
  @UseGuards(JwtOrApiTokenGuard)
  async remove(@Param('id') id: string, @Req() req: UnifiedAuthRequest) {
    await this.mediaService.checkMediaAccess(id, req.user.userId);
    return this.mediaService.remove(id);
  }

  /**
   * Reprocess existing media with new settings.
   */
  @Post(':id/reprocess')
  @UseGuards(JwtOrApiTokenGuard)
  async reprocess(
    @Param('id') id: string,
    @Body() optimize: Record<string, any>,
    @Req() req: UnifiedAuthRequest,
  ) {
    await this.mediaService.checkMediaAccess(id, req.user.userId);
    const { fileId, metadata } = await this.mediaService.reprocessFile(
      id,
      optimize,
      req.user.userId,
    );

    // Update the existing record with new metadata and potentially new storagePath (if fileId changed)
    const existingMedia = await this.mediaService.findOne(id);
    return this.mediaService.update(id, {
      storagePath: fileId,
      mimeType: metadata.mimeType,
      sizeBytes: metadata.size,
      meta: {
        ...existingMedia.meta,
        ...metadata,
      },
    });
  }

  /**
   * Public endpoint for media files used by external services (Telegram, etc).
   * Verifies a signature token instead of requiring JWT.
   */
  @Get('p/:id/:token')
  async getPublicFile(
    @Param('id') id: string,
    @Param('token') token: string,
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
    @Query('download') download?: string,
  ) {
    if (!this.mediaService.verifyPublicToken(id, token)) {
      throw new BadRequestException('Invalid media token');
    }

    const range = req.headers.range;
    const { stream, status, headers } = await this.mediaService.getMediaFile(
      id,
      undefined, // Skip permission check
      range as string,
      download === '1' || download === 'true',
    );

    res.status(status);
    res.headers(headers);
    return res.send(stream);
  }
}
