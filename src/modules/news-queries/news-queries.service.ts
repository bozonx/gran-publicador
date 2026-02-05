import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateNewsQueryDto } from './dto/create-news-query.dto.js';
import { UpdateNewsQueryDto } from './dto/update-news-query.dto.js';

@Injectable()
export class NewsQueriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(projectId: string) {
    const queries = await this.prisma.projectNewsQuery.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });

    // Remap DB fields to flat structure for frontend compatibility (and convenience)
    return queries.map(q => this.mapToResponse(q));
  }

  async findAllDefault(userId: string) {
    // Find all projects where user is owner or member
    const projects = await this.prisma.project.findMany({
      where: {
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      select: { id: true, name: true },
    });

    const projectIds = projects.map(p => p.id);

    const queries = await this.prisma.projectNewsQuery.findMany({
      where: {
        projectId: { in: projectIds },
        isNotificationEnabled: true,
      },
      include: {
        project: { select: { name: true } },
      },
    });

    return queries.map(q => ({
      ...this.mapToResponse(q),
      projectName: q.project.name,
    }));
  }

  async create(projectId: string, dto: CreateNewsQueryDto) {
    // If setting as default, unset others

    // Get max order
    const lastItem = await this.prisma.projectNewsQuery.findFirst({
      where: { projectId },
      orderBy: { order: 'desc' },
    });
    const order = (lastItem?.order ?? -1) + 1;

    // Separate clean settings from meta
    const { name, ...settings } = dto;

    const query = await this.prisma.projectNewsQuery.create({
      data: {
        projectId,
        name,
        order,
        settings: settings as any,
      },
    });

    return this.mapToResponse(query);
  }

  async update(id: string, projectId: string, dto: UpdateNewsQueryDto) {
    const query = await this.prisma.projectNewsQuery.findUnique({
      where: { id },
    });

    if (query?.projectId !== projectId) {
      throw new NotFoundException('Query not found');
    }

    const { name, isNotificationEnabled, ...settingsUpdate } = dto;

    // Merge existing settings with updates
    const currentSettings = query.settings as any;
    const newSettings = { ...currentSettings, ...settingsUpdate };

    const updated = await this.prisma.projectNewsQuery.update({
      where: { id },
      data: {
        name,
        isNotificationEnabled,
        settings: newSettings,
      },
    });

    return this.mapToResponse(updated);
  }

  async remove(id: string, projectId: string) {
    const query = await this.prisma.projectNewsQuery.findUnique({
      where: { id },
    });

    if (query?.projectId !== projectId) {
      throw new NotFoundException('Query not found');
    }

    await this.prisma.projectNewsQuery.delete({ where: { id } });
    return { success: true };
  }

  // Helper to flatten the response so frontend gets a similar shape as before
  private mapToResponse(query: any) {
    const settings = query.settings || {};
    return {
      id: query.id,
      projectId: query.projectId,
      name: query.name,
      isNotificationEnabled: query.isNotificationEnabled,
      order: query.order,
      createdAt: query.createdAt,
      updatedAt: query.updatedAt,
      // Flatten settings
      q: settings.q,
      mode: settings.mode,
      lang: settings.lang,
      sourceTags: settings.sourceTags,
      source: settings.source,
      sources: settings.sources,
      newsTags: settings.newsTags,
      minScore: settings.minScore,
      since: settings.since,
      savedFrom: settings.savedFrom,
      savedTo: settings.savedTo,
      orderBy: settings.orderBy,
      note: settings.note,
    };
  }
}
