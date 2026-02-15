import { Controller, Get, Post, Body, Param, Delete, Patch, UseGuards, Req } from '@nestjs/common';
import { NewsQueriesService } from './news-queries.service.js';
import { CreateNewsQueryDto } from './dto/create-news-query.dto.js';
import { UpdateNewsQueryDto } from './dto/update-news-query.dto.js';
import { ReorderNewsQueriesDto } from './dto/reorder-news-queries.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';

@Controller('projects/:projectId/news-queries')
@UseGuards(JwtAuthGuard)
export class NewsQueriesController {
  constructor(private readonly newsQueriesService: NewsQueriesService) {}

  @Get()
  findAll(@Param('projectId') projectId: string) {
    return this.newsQueriesService.findAll(projectId);
  }

  @Patch('reorder')
  reorder(@Param('projectId') projectId: string, @Body() reorderDto: ReorderNewsQueriesDto) {
    return this.newsQueriesService.reorder(projectId, reorderDto);
  }

  @Post()
  create(@Param('projectId') projectId: string, @Body() createNewsQueryDto: CreateNewsQueryDto) {
    return this.newsQueriesService.create(projectId, createNewsQueryDto);
  }

  @Patch(':id')
  update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() updateNewsQueryDto: UpdateNewsQueryDto,
  ) {
    return this.newsQueriesService.update(id, projectId, updateNewsQueryDto);
  }

  @Delete(':id')
  remove(@Param('projectId') projectId: string, @Param('id') id: string) {
    return this.newsQueriesService.remove(id, projectId);
  }
}
