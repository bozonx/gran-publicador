import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { join } from 'path';
import { mkdir, writeFile, unlink } from 'fs/promises';
import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateMediaDto, CreateMediaGroupDto, UpdateMediaDto } from './dto/index.js';
import { MediaType, MediaSourceType } from '../../generated/prisma/client.js';
import { getMediaDir } from '../../config/media.config.js';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly mediaDir: string;

  constructor(private prisma: PrismaService) {
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
