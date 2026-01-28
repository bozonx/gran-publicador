import { Module } from '@nestjs/common';
import { NewsQueriesService } from './news-queries.service.js';
import { NewsQueriesController } from './news-queries.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [NewsQueriesController],
  providers: [NewsQueriesService],
  exports: [NewsQueriesService],
})
export class NewsQueriesModule {}
