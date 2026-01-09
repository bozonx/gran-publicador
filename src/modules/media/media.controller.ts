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
  Request,
  BadRequestException,
  UseGuards
} from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import { MediaService } from './media.service.js';
import { CreateMediaDto, UpdateMediaDto } from './dto/index.js';
import { JwtOrApiTokenGuard } from '../../common/guards/jwt-or-api-token.guard.js';
import { UnifiedAuthRequest } from '../../common/types/unified-auth-request.interface.js';

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post()
  @UseGuards(JwtOrApiTokenGuard)
  create(@Body() createMediaDto: CreateMediaDto) {
    return this.mediaService.create(createMediaDto);
  }

  // Upload endpoint with multipart support
  @Post('upload')
  @UseGuards(JwtOrApiTokenGuard)
  async upload(@Req() req: FastifyRequest) {
    if (!req.isMultipart || !req.isMultipart()) {
      throw new BadRequestException('Request is not multipart');
    }

    const part = await req.file() as MultipartFile | undefined;
    if (!part) {
      throw new BadRequestException('No file uploaded');
    }

    const buffer = await part.toBuffer();

    const fileInfo = await this.mediaService.saveFile({
      filename: part.filename,
      buffer: buffer,
      mimetype: part.mimetype
    });

    // Create the media record
    return this.mediaService.create({
      type: fileInfo.type,
      storageType: 'FS',
      storagePath: fileInfo.path,
      filename: fileInfo.filename,
      mimeType: fileInfo.mimetype,
      sizeBytes: fileInfo.size,
      meta: fileInfo.metadata || {}
    });
  }

  // Upload from URL endpoint
  @Post('upload-from-url')
  @UseGuards(JwtOrApiTokenGuard)
  async uploadFromUrl(@Body() body: { url: string; filename?: string }) {
    if (!body.url) {
      throw new BadRequestException('URL is required');
    }

    const fileInfo = await this.mediaService.downloadAndSaveFromUrl(body.url, body.filename);

    // Create the media record with original URL in meta
    return this.mediaService.create({
      type: fileInfo.type,
      storageType: 'FS',
      storagePath: fileInfo.path,
      filename: fileInfo.filename,
      mimeType: fileInfo.mimetype,
      sizeBytes: fileInfo.size,
      meta: {
        originalUrl: fileInfo.originalUrl,
        ...(fileInfo.metadata || {})
      }
    });
  }

  @Get()
  @UseGuards(JwtOrApiTokenGuard)
  findAll() {
    return this.mediaService.findAll();
  }

  @Get(':id/file')
  async getFile(
    @Param('id') id: string, 
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply
  ) {
    // Stream media file - res.raw is the native Node.js ServerResponse
    const range = req.headers.range;
    return this.mediaService.streamMediaFile(id, res.raw, undefined, range);
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

  /**
   * Get EXIF metadata for a media item.
   */
  @Get(':id/exif')
  @UseGuards(JwtOrApiTokenGuard)
  public async getExif(@Req() req: UnifiedAuthRequest, @Param('id') id: string) {
    await this.mediaService.checkMediaAccess(id, req.user.userId);
    return this.mediaService.getExif(id);
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
