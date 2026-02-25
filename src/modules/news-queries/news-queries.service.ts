import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateNewsQueryDto } from './dto/create-news-query.dto.js';
import { UpdateNewsQueryDto } from './dto/update-news-query.dto.js';
import { ReorderNewsQueriesDto } from './dto/reorder-news-queries.dto.js';
import { PermissionsService } from '../../common/services/permissions.service.js';

@Injectable()
export class NewsQueriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  async findAll(projectId: string, userId: string) {
    await this.permissions.checkProjectAccess(projectId, userId);

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

  async create(projectId: string, userId: string, dto: CreateNewsQueryDto) {
    await this.permissions.checkProjectAccess(projectId, userId);

    // If setting as default, unset others

    // Get max order
    const lastItem = await this.prisma.projectNewsQuery.findFirst({
      where: { projectId },
      orderBy: { order: 'desc' },
    });
    const order = (lastItem?.order ?? -1) + 1;

    // Separate clean settings from notification flag and name
    const { name, isNotificationEnabled, ...settings } = dto;

    const query = await this.prisma.projectNewsQuery.create({
      data: {
        projectId,
        name,
        order,
        isNotificationEnabled: isNotificationEnabled ?? false,
        settings: settings as any,
      },
    });

    return this.mapToResponse(query);
  }

  async update(id: string, projectId: string, userId: string, dto: UpdateNewsQueryDto) {
    await this.permissions.checkProjectAccess(projectId, userId);

    const query = await this.prisma.projectNewsQuery.findUnique({
      where: { id },
    });

    if (query?.projectId !== projectId) {
      throw new NotFoundException('Query not found');
    }

    const { name, isNotificationEnabled, version, ...settingsUpdate } = dto;

    // Direct merge for simplicity, but we can also handle deletions if needed
    // Note: If we want to allow deleting fields, we'd need a different DTO structure
    const currentSettings = (query.settings as Record<string, any>) || {};
    const newSettings = { ...currentSettings, ...settingsUpdate };

    const updateData: any = {
      name,
      isNotificationEnabled,
      settings: newSettings,
    };

    if (version !== undefined) {
      updateData.version = { increment: 1 };
      const { count } = await this.prisma.projectNewsQuery.updateMany({
        where: { id, version: version },
        data: updateData,
      });

      if (count === 0) {
        throw new ConflictException('Запрос был изменен в другой вкладке. Обновите страницу.');
      }

      const updated = await this.prisma.projectNewsQuery.findUnique({ where: { id } });
      return this.mapToResponse(updated);
    }

    const updated = await this.prisma.projectNewsQuery.update({
      where: { id },
      data: updateData,
    });

    return this.mapToResponse(updated);
  }

  async remove(id: string, projectId: string, userId: string) {
    await this.permissions.checkProjectAccess(projectId, userId);

    const query = await this.prisma.projectNewsQuery.findUnique({
      where: { id },
    });

    if (query?.projectId !== projectId) {
      throw new NotFoundException('Query not found');
    }

    await this.prisma.projectNewsQuery.delete({ where: { id } });
    return { success: true };
  }

  async reorder(projectId: string, userId: string, dto: ReorderNewsQueriesDto) {
    await this.permissions.checkProjectAccess(projectId, userId);

    // Verify that all IDs belong to the project
    const count = await this.prisma.projectNewsQuery.count({
      where: {
        projectId,
        id: { in: dto.ids },
      },
    });

    if (count !== dto.ids.length) {
      throw new NotFoundException('Some queries not found or do not belong to the project');
    }

    // Execute updates in transaction
    await this.prisma.$transaction(
      dto.ids.map((id, index) =>
        this.prisma.projectNewsQuery.update({
          where: { id },
          data: { order: index },
        }),
      ),
    );

    return { success: true };
  }

  // Helper to flatten the response so frontend gets a similar shape as before
  private mapToResponse(query: any) {
    const settings = (query.settings as Record<string, any>) || {};
    return {
      ...query,
      settings: undefined, // Remove nested settings
      ...settings, // Flatten all settings fields automatically
    };
  }
}
