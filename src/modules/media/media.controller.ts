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
import { StorageType } from '../../generated/prisma/client.js';
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

    // Upload to Media Storage using stream
    const { fileId, metadata } = await this.mediaService.uploadFileToStorage(
      fileStream,
      part.filename,
      part.mimetype,
      req.user.userId,
      undefined,
      optimize,
    );

    // Create the media record with fileId from Media Storage
    return this.mediaService.create({
      type: getMediaTypeFromMime(metadata.mimeType),
      storageType: StorageType.FS,
      storagePath: fileId, // Store Media Storage fileId
      filename: part.filename,
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
   * For StorageType.FS: proxies from Media Storage
   * For StorageType.TELEGRAM: streams from Telegram API
   */
  @Get(':id/file')
  @UseGuards(JwtOrApiTokenGuard)
  async getFile(@Param('id') id: string, @Req() req: UnifiedAuthRequest, @Res() res: FastifyReply) {
    const range = req.headers.range;
    const { stream, status, headers } = await this.mediaService.getMediaFile(
      id,
      req.user.userId,
      range,
    );

    res.status(status);
    res.headers(headers);
    return res.send(stream);
  }

  /**
   * Get thumbnail for media.
   * For StorageType.FS: proxied from Media Storage.
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
    if (media.storageType !== StorageType.FS) {
      throw new BadRequestException('Only FS media has extended info');
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
    return this.mediaService.update(id, {
      storagePath: fileId,
      mimeType: metadata.mimeType,
      sizeBytes: metadata.size,
      meta: metadata,
    });
  }
}
