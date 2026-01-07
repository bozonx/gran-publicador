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
  Request
} from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import { MediaService } from './media.service.js';
import { CreateMediaDto, CreateMediaGroupDto, UpdateMediaDto } from './dto/index.js';
import { JwtOrApiTokenGuard } from '../../common/guards/jwt-or-api-token.guard.js';
import type { UnifiedAuthRequest } from '../../common/types/unified-auth-request.interface.js';

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
      srcType: 'FS',
      src: fileInfo.path,
      filename: fileInfo.filename,
      mimeType: fileInfo.mimetype,
      sizeBytes: fileInfo.size,
      meta: {}
    });
  }

  @Get()
  @UseGuards(JwtOrApiTokenGuard)
  findAll() {
    return this.mediaService.findAll();
  }

  @Get(':id/file')
  @UseGuards(JwtOrApiTokenGuard)
  async getFile(
    @Request() req: UnifiedAuthRequest,
    @Param('id') id: string, 
    @Res() res: FastifyReply
  ) {
    // Stream media file - res.raw is the native Node.js ServerResponse
    return this.mediaService.streamMediaFile(id, res.raw, req.user.userId);
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

  @Post('groups')
  @UseGuards(JwtOrApiTokenGuard)
  createGroup(@Body() createGroupDto: CreateMediaGroupDto) {
    return this.mediaService.createGroup(createGroupDto);
  }

  @Get('groups/:id')
  @UseGuards(JwtOrApiTokenGuard)
  findGroup(@Param('id') id: string) {
    return this.mediaService.findGroup(id);
  }
}
