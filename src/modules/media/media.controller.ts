import { Body, Controller, Delete, Get, Param, Patch, Post, Req, BadRequestException } from '@nestjs/common';
import { MediaService } from './media.service.js';
import { CreateMediaDto, CreateMediaGroupDto, UpdateMediaDto } from './dto/index.js';
// import { FastifyRequest } from 'fastify'; // Need to import this type if using it.
// To avoid compilation errors if types are missing, I'll use any for req for now or rely on inference.
// But better to use proper types.

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post()
  create(@Body() createMediaDto: CreateMediaDto) {
    return this.mediaService.create(createMediaDto);
  }

  // Upload endpoint to be implemented with @fastify/multipart
  @Post('upload')
  async upload(@Req() req: any) {
      if (!req.isMultipart || !req.isMultipart()) {
          throw new BadRequestException('Request is not multipart');
      }
      
      const part = await req.file();
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
          srcType: 'FS' as any, // Enum type
          src: fileInfo.path,
          filename: fileInfo.filename,
          mimeType: fileInfo.mimetype,
          sizeBytes: fileInfo.size,
          meta: {}
      });
  }

  @Get()
  findAll() {
      return this.mediaService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.mediaService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateMediaDto: UpdateMediaDto) {
    return this.mediaService.update(id, updateMediaDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.mediaService.remove(id);
  }

  @Post('groups')
  createGroup(@Body() createGroupDto: CreateMediaGroupDto) {
      return this.mediaService.createGroup(createGroupDto);
  }

  @Get('groups/:id')
  findGroup(@Param('id') id: string) {
      return this.mediaService.findGroup(id);
  }
}
