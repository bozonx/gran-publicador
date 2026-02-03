import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';
import { ContentLibraryController } from './content-library.controller.js';
import { ContentLibraryService } from './content-library.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [ContentLibraryController],
  providers: [ContentLibraryService],
  exports: [ContentLibraryService],
})
export class ContentLibraryModule {}
