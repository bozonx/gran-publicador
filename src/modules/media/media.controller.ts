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
} from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { MediaService } from './media.service.js';
import { CreateMediaDto, UpdateMediaDto } from './dto/index.js';
import { JwtOrApiTokenGuard } from '../../common/guards/jwt-or-api-token.guard.js';
import type { UnifiedAuthRequest } from '../../common/types/unified-auth-request.interface.js';
import { MediaType, StorageType } from '../../generated/prisma/client.js';

@Controller('media')
export class MediaController {
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
      throw new BadRequestException('No file uploaded');
    }

    // Convert to buffer for upload to Media Storage
    // In future, we could stream directly to Media Storage
    const buffer = await part.toBuffer();

    // Upload to Media Storage
    const { fileId, metadata } = await this.mediaService.uploadFileToStorage(
      buffer,
      part.filename,
      part.mimetype,
      req.user.userId,
    );

    // Determine media type from mimetype
    let type: MediaType = MediaType.DOCUMENT;
    const mime = metadata.mimeType.toLowerCase();
    if (mime.startsWith('image/')) type = MediaType.IMAGE;
    else if (mime.startsWith('video/')) type = MediaType.VIDEO;
    else if (mime.startsWith('audio/')) type = MediaType.AUDIO;

    // Create the media record with fileId from Media Storage
    return this.mediaService.create({
      type,
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
    @Body() body: { url: string; filename?: string },
    @Req() req: UnifiedAuthRequest,
  ) {
    if (!body.url) {
      throw new BadRequestException('URL is required');
    }

    // Upload to Media Storage via URL
    // Upload to Media Storage via URL
    const { fileId, metadata } = await this.mediaService.uploadFileFromUrl(
      body.url,
      body.filename,
      req.user.userId,
    );

    // Determine media type from mimetype
    let type: MediaType = MediaType.DOCUMENT;
    const mime = metadata.mimeType.toLowerCase();
    if (mime.startsWith('image/')) type = MediaType.IMAGE;
    else if (mime.startsWith('video/')) type = MediaType.VIDEO;
    else if (mime.startsWith('audio/')) type = MediaType.AUDIO;

    // Extract filename from URL if not provided
    const filename = body.filename || this.extractFilenameFromUrl(body.url);

    // Create the media record with fileId from Media Storage
    return this.mediaService.create({
      type,
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

    const { stream, status, headers } = await this.mediaService.getMediaThumbnail(
      id,
      width,
      height,
      quality,
      req.user.userId,
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

  @Patch(':id')
  @UseGuards(JwtOrApiTokenGuard)
  update(@Param('id') id: string, @Body() updateMediaDto: UpdateMediaDto) {
    return this.mediaService.update(id, updateMediaDto);
  }

  @Delete(':id')
  @UseGuards(JwtOrApiTokenGuard)
  remove(@Param('id') id: string) {
    return this.mediaService.remove(id);
  }
}
