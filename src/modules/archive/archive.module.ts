import { Module } from '@nestjs/common';
import { ArchiveController } from './archive.controller.js';
import { ArchiveService } from './archive.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [ArchiveController],
  providers: [ArchiveService],
  exports: [ArchiveService],
})
export class ArchiveModule {}
