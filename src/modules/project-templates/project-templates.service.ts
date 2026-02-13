import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

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
        // If setting as default, unset other defaults
        if (data.isDefault) {
          const targetLanguage = data.language !== undefined ? data.language : null;
          const targetPostType = data.postType ?? null;
          await tx.projectTemplate.updateMany({
            where: {
              projectId,
              isDefault: true,
              language: targetLanguage,
              postType: targetPostType,
            },
            data: { isDefault: false },
          });
        }

        return tx.projectTemplate.create({
          data: {
            projectId,
            name: data.name,
            postType: data.postType ?? null,
            isDefault: data.isDefault ?? false,
            language: data.language !== undefined ? data.language : null,
            order: nextOrder,
            template: data.template as any,
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
        const nextLanguage = data.language !== undefined ? data.language : existing.language;
        const nextPostType = data.postType !== undefined ? data.postType : existing.postType;

        const shouldEnforceGroupDefaultUniqueness =
          data.isDefault === true ||
          (existing.isDefault &&
            (data.language !== undefined || data.postType !== undefined) &&
            (nextLanguage !== existing.language || nextPostType !== existing.postType));

        // If setting as default (or moving a default template to another group), unset other defaults in the same group
        if (shouldEnforceGroupDefaultUniqueness) {
          await tx.projectTemplate.updateMany({
            where: {
              projectId,
              isDefault: true,
              language: nextLanguage,
              postType: nextPostType,
              id: { not: templateId },
            },
            data: { isDefault: false },
          });
        }

        return tx.projectTemplate.update({
          where: { id: templateId },
          data: {
            name: data.name,
            postType: data.postType !== undefined ? data.postType : undefined,
            isDefault: data.isDefault,
            language: data.language,
            template: data.template ? (data.template as any) : undefined,
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
