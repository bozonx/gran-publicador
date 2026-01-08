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
  UseGuards
} from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import { MediaService } from './media.service.js';
import { CreateMediaDto, UpdateMediaDto } from './dto/index.js';
import { JwtOrApiTokenGuard } from '../../common/guards/jwt-or-api-token.guard.js';

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
      meta: {}
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
        originalUrl: fileInfo.originalUrl
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
    @Res() res: FastifyReply
  ) {
    // Stream media file - res.raw is the native Node.js ServerResponse
    return this.mediaService.streamMediaFile(id, res.raw);
  }

  @Get(':id')
  @UseGuards(JwtOrApiTokenGuard)
  findOne(@Param('id') id: string) {
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
