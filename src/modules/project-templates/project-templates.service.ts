import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service.js';
import { PermissionsService } from '../../common/services/permissions.service.js';
import { PermissionKey } from '../../common/types/permissions.types.js';
import { TRANSACTION_TIMEOUT } from '../../common/constants/database.constants.js';
import type { CreateProjectTemplateDto } from './dto/create-project-template.dto.js';
import type { UpdateProjectTemplateDto } from './dto/update-project-template.dto.js';
import type { ReorderProjectTemplatesDto } from './dto/reorder-project-templates.dto.js';

@Injectable()
export class ProjectTemplatesService {
  private readonly logger = new Logger(ProjectTemplatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  /**
   * Ensure the project exists and is not archived (for mutations).
   */
  private async getProjectOrThrow(projectId: string, allowArchived = false) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, archivedAt: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (!allowArchived && project.archivedAt) {
      throw new ForbiddenException('Cannot modify templates in an archived project');
    }
    return project;
  }

  /**
   * List all project templates.
   */
  public async findAll(projectId: string, userId: string) {
    await this.permissions.checkPermission(projectId, userId, PermissionKey.PROJECT_READ);

    return this.prisma.projectTemplate.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });
  }

  /**
   * Get a single project template by ID.
   */
  public async findOne(projectId: string, templateId: string, userId: string) {
    await this.permissions.checkPermission(projectId, userId, PermissionKey.PROJECT_READ);

    const template = await this.prisma.projectTemplate.findFirst({
      where: { id: templateId, projectId },
    });
    if (!template) throw new NotFoundException('Project template not found');
    return template;
  }

  /**
   * Create a new project template.
   */
  public async create(projectId: string, userId: string, data: CreateProjectTemplateDto) {
    await this.getProjectOrThrow(projectId);
    await this.permissions.checkPermission(projectId, userId, PermissionKey.PROJECT_UPDATE);

    // Get the next order value
    const maxOrder = await this.prisma.projectTemplate.aggregate({
      where: { projectId },
      _max: { order: true },
    });
    const nextOrder = (maxOrder._max.order ?? -1) + 1;

    return this.prisma.$transaction(
      async tx => {
        return tx.projectTemplate.create({
          data: {
            projectId,
            name: data.name,
            postType: data.postType ?? null,
            language: data.language !== undefined ? data.language : null,
            order: nextOrder,
            template: (data.template as any[]).map(b => ({
              id: b.id || randomUUID(),
              ...b,
            })),
          },
        });
      },
      {
        maxWait: TRANSACTION_TIMEOUT.MAX_WAIT,
        timeout: TRANSACTION_TIMEOUT.TIMEOUT,
      },
    );
  }

  /**
   * Update an existing project template.
   */
  public async update(
    projectId: string,
    templateId: string,
    userId: string,
    data: UpdateProjectTemplateDto,
  ) {
    await this.getProjectOrThrow(projectId);
    await this.permissions.checkPermission(projectId, userId, PermissionKey.PROJECT_UPDATE);

    const existing = await this.prisma.projectTemplate.findFirst({
      where: { id: templateId, projectId },
    });
    if (!existing) throw new NotFoundException('Project template not found');

    return this.prisma.$transaction(
      async tx => {
        const updateData: any = {
          name: data.name,
          postType: data.postType !== undefined ? data.postType : undefined,
          language: data.language,
          template: data.template
            ? (data.template as any[]).map(b => ({
                id: b.id || randomUUID(),
                ...b,
              }))
            : undefined,
        };

        if (data.version !== undefined) {
          updateData.version = { increment: 1 };
          const { count } = await tx.projectTemplate.updateMany({
            where: { id: templateId, version: data.version },
            data: updateData,
          });

          if (count === 0) {
            throw new ConflictException('Шаблон был изменен в другой вкладке. Обновите страницу.');
          }

          return tx.projectTemplate.findUnique({ where: { id: templateId } });
        }

        return tx.projectTemplate.update({
          where: { id: templateId },
          data: updateData,
        });
      },
      {
        maxWait: TRANSACTION_TIMEOUT.MAX_WAIT,
        timeout: TRANSACTION_TIMEOUT.TIMEOUT,
      },
    );
  }

  /**
   * Delete a project template and remove all channel variations referencing it.
   */
  public async remove(projectId: string, templateId: string, userId: string) {
    await this.getProjectOrThrow(projectId);
    await this.permissions.checkPermission(projectId, userId, PermissionKey.PROJECT_UPDATE);

    const existing = await this.prisma.projectTemplate.findFirst({
      where: { id: templateId, projectId },
    });
    if (!existing) throw new NotFoundException('Project template not found');

    return this.prisma.$transaction(
      async tx => {
        // Protect the last template from being deleted
        const count = await tx.projectTemplate.count({
          where: { projectId },
        });

        if (count <= 1) {
          throw new BadRequestException('Project must have at least one template');
        }

        // Delete the project template
        // Unlink publications referencing this template (FK will also handle it on delete, but keep explicit)
        await tx.publication.updateMany({
          where: {
            projectId,
            projectTemplateId: templateId,
          },
          data: {
            projectTemplateId: null,
          },
        });

        await tx.projectTemplate.delete({ where: { id: templateId } });

        // Remove channel variations referencing this template
        const channels = await tx.channel.findMany({
          where: { projectId },
          select: { id: true, preferences: true },
        });

        for (const channel of channels) {
          const prefs = (channel.preferences as any) || {};
          const templates = prefs.templates as any[] | undefined;
          if (!templates || !Array.isArray(templates)) continue;

          const filtered = templates.filter((t: any) => t.projectTemplateId !== templateId);

          if (filtered.length !== templates.length) {
            await tx.channel.update({
              where: { id: channel.id },
              data: {
                preferences: { ...prefs, templates: filtered },
              },
            });
          }
        }

        this.logger.log(`Deleted project template ${templateId} and cleaned up channel variations`);
      },
      {
        maxWait: TRANSACTION_TIMEOUT.MAX_WAIT,
        timeout: TRANSACTION_TIMEOUT.TIMEOUT,
      },
    );
  }

  /**
   * Reorder project templates.
   */
  public async reorder(projectId: string, userId: string, data: ReorderProjectTemplatesDto) {
    await this.getProjectOrThrow(projectId);
    await this.permissions.checkPermission(projectId, userId, PermissionKey.PROJECT_UPDATE);

    return this.prisma.$transaction(
      async tx => {
        for (let i = 0; i < data.ids.length; i++) {
          await tx.projectTemplate.updateMany({
            where: { id: data.ids[i], projectId },
            data: { order: i },
          });
        }
      },
      {
        maxWait: TRANSACTION_TIMEOUT.MAX_WAIT,
        timeout: TRANSACTION_TIMEOUT.TIMEOUT,
      },
    );
  }
}
