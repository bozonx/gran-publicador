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
  async upload(@Req() req: FastifyRequest) {
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
  async uploadFromUrl(@Body() body: { url: string; filename?: string }) {
    if (!body.url) {
      throw new BadRequestException('URL is required');
    }

    // TODO: Implement upload from URL via Media Storage
    // For now, return not implemented
    throw new BadRequestException('Upload from URL not yet implemented with Media Storage');
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
    // Check access
    await this.mediaService.checkMediaAccess(id, req.user.userId);

    const media = await this.mediaService.findOne(id);
    const range = req.headers.range;

    if (media.storageType === StorageType.FS) {
      const fileId = media.storagePath;
      const { stream, status, headers } = await this.mediaService.getFileStream(fileId, range);

      res.status(status);
      res.headers(headers);
      return res.send(stream);
    } else if (media.storageType === StorageType.TELEGRAM) {
      // Use existing legacy streaming for Telegram (it uses res.raw)
      return this.mediaService.streamMediaFile(id, res.raw, req.user.userId, range);
    } else {
      throw new BadRequestException('Unsupported storage type');
    }
  }

  /**
   * Get thumbnail for media.
   * Only supported for StorageType.FS (proxied from Media Storage).
   * Returns error for StorageType.TELEGRAM.
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
    // Check access
    await this.mediaService.checkMediaAccess(id, req.user.userId);

    // Get media to check storage type
    const media = await this.mediaService.findOne(id);

    // Thumbnails only supported for FS storage
    if (media.storageType !== StorageType.FS) {
      throw new BadRequestException('Thumbnails are not supported for Telegram files');
    }

    const width = widthStr ? parseInt(widthStr, 10) : 400;
    const height = heightStr ? parseInt(heightStr, 10) : 400;
    const quality = qualityStr ? parseInt(qualityStr, 10) : undefined;

    const fileId = media.storagePath;
    const { stream, status, headers } = await this.mediaService.getThumbnailStream(
      fileId,
      width,
      height,
      quality,
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
