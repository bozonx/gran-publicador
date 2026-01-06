import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { mkdir, writeFile, unlink } from 'fs/promises';
import { createReadStream, existsSync } from 'fs';
import { randomUUID } from 'crypto';
import { request } from 'undici';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateMediaDto, CreateMediaGroupDto, UpdateMediaDto } from './dto/index.js';
import { MediaType, MediaSourceType } from '../../generated/prisma/client.js';
import { getMediaDir } from '../../config/media.config.js';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly mediaDir: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.mediaDir = getMediaDir();
    this.ensureMediaDir();
  }

  private async ensureMediaDir() {
      if (!existsSync(this.mediaDir)) {
          await mkdir(this.mediaDir, { recursive: true });
      }
  }

  async create(data: CreateMediaDto) {
    return this.prisma.media.create({
      data: {
        ...data,
        meta: JSON.stringify(data.meta || {}),
      },
    });
  }

  async findAll() {
      return this.prisma.media.findMany({
          orderBy: { createdAt: 'desc' }
      });
  }

  async findOne(id: string) {
    const media = await this.prisma.media.findUnique({ where: { id } });
    if (!media) throw new NotFoundException(`Media with ID ${id} not found`);
    return {
        ...media,
        meta: JSON.parse(media.meta)
    };
  }

  async update(id: string, data: UpdateMediaDto) {
      const media = await this.prisma.media.findUnique({ where: { id } });
      if (!media) throw new NotFoundException(`Media with ID ${id} not found`);

      return this.prisma.media.update({
          where: { id },
          data: {
              ...data,
              meta: data.meta ? JSON.stringify(data.meta) : undefined
          }
      });
  }

  async remove(id: string) {
    const media = await this.prisma.media.findUnique({ where: { id } });
    if (!media) throw new NotFoundException(`Media with ID ${id} not found`);

    // If it's a local file, we might want to delete it
    if (media.srcType === MediaSourceType.FS) {
        try {
            const filePath = join(this.mediaDir, media.src);
            if (existsSync(filePath)) {
                await unlink(filePath);
            }
        } catch (e) {
            this.logger.error(`Failed to delete file for media ${id}: ${e}`);
        }
    }

    return this.prisma.media.delete({ where: { id } });
  }

  // File System Operations
  async saveFile(file: { filename: string, buffer: Buffer, mimetype: string }) {
     const date = new Date();
     const year = date.getFullYear().toString();
     const month = (date.getMonth() + 1).toString().padStart(2, '0');
     const subfolder = join(year, month);
     const fullDir = join(this.mediaDir, subfolder);
     
     await mkdir(fullDir, { recursive: true });
     
     const ext = file.filename.split('.').pop() || 'bin';
     const uniqueFilename = `${randomUUID()}.${ext}`;
     const relativePath = join(subfolder, uniqueFilename);
     const filePath = join(fullDir, uniqueFilename);
     
     await writeFile(filePath, file.buffer);
     
     // Determine MediaType based on mimetype
     let type: MediaType = MediaType.DOCUMENT;
     if (file.mimetype.startsWith('image/')) type = MediaType.IMAGE;
     else if (file.mimetype.startsWith('video/')) type = MediaType.VIDEO;
     else if (file.mimetype.startsWith('audio/')) type = MediaType.AUDIO;

     return {
        path: relativePath,
        size: file.buffer.length,
        mimetype: file.mimetype,
        type,
        filename: file.filename
     };
  }

  // Media Groups
  async createGroup(data: CreateMediaGroupDto) {
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
   * Stream media file to response based on source type
   */
  async streamMediaFile(id: string, res: any) {
    const media = await this.prisma.media.findUnique({ where: { id } });
    if (!media) {
      throw new NotFoundException('Файл не найден');
    }

    try {
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
          throw new NotFoundException('Неподдерживаемый тип источника');
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to stream media ${id}: ${err.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException('Файл недоступен');
    }
  }

  /**
   * Stream file from local filesystem
   */
  private async streamFromFileSystem(media: any, res: any) {
    const filePath = join(this.mediaDir, media.src);
    
    this.logger.log(`Attempting to stream file: ${filePath}`);
    this.logger.log(`Media dir: ${this.mediaDir}, Media src: ${media.src}`);
    
    if (!existsSync(filePath)) {
      this.logger.error(`File not found: ${filePath}`);
      throw new NotFoundException('Файл не найден');
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
    const fileStream = createReadStream(filePath);
    fileStream.pipe(res);
  }

  /**
   * Proxy stream from external URL
   */
  private async streamFromUrl(media: any, res: any): Promise<void> {
    try {
      const response = await request(media.src, {
        method: 'GET',
      });

      if (response.statusCode !== 200) {
        throw new NotFoundException('Файл недоступен');
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
      throw new NotFoundException('Файл недоступен');
    }
  }

  /**
   * Stream file from Telegram using Bot API
   */
  private async streamFromTelegram(media: any, res: any): Promise<void> {
    const telegramBotToken = this.configService.get<string>('app.telegramBotToken');
    
    if (!telegramBotToken) {
      this.logger.error('Telegram bot token not configured');
      throw new NotFoundException('Файл Telegram недоступен');
    }

    try {
      // Step 1: Get file path from Telegram
      const getFileUrl = `https://api.telegram.org/bot${telegramBotToken}/getFile?file_id=${encodeURIComponent(media.src)}`;
      const getFileResponse = await request(getFileUrl, { method: 'GET' });
      
      if (getFileResponse.statusCode !== 200) {
        throw new Error('Failed to get file info from Telegram');
      }

      const fileInfo = await getFileResponse.body.json() as any;
      
      if (!fileInfo.ok || !fileInfo.result?.file_path) {
        throw new Error('Invalid file_id or file not found');
      }

      // Step 2: Download file from Telegram
      const fileUrl = `https://api.telegram.org/file/bot${telegramBotToken}/${fileInfo.result.file_path}`;
      const fileResponse = await request(fileUrl, { method: 'GET' });

      if (fileResponse.statusCode !== 200) {
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
      throw new NotFoundException('Файл Telegram недоступен');
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
      if (!group) throw new NotFoundException(`MediaGroup with ID ${id} not found`);
      return group;
  }
}
