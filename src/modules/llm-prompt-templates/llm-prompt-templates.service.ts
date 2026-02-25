import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PermissionsService } from '../../common/services/permissions.service.js';
import { PermissionKey } from '../../common/types/permissions.types.js';
import { CreateLlmPromptTemplateDto } from './dto/create-llm-prompt-template.dto.js';
import { UpdateLlmPromptTemplateDto } from './dto/update-llm-prompt-template.dto.js';
import { SYSTEM_LLM_PROMPT_TEMPLATES } from './system-prompts.js';

const MAX_PROMPT_LENGTH = 5000;

@Injectable()
export class LlmPromptTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService,
  ) {}

  private getPreferencePath() {
    return {
      rootKey: 'llmPromptTemplates',
      availableOrderByProjectIdKey: 'availableOrderByProjectId',
    };
  }

  private async getAvailableOrderFromPreferences(params: {
    userId: string;
    projectId: string;
  }): Promise<string[]> {
    const { userId, projectId } = params;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });

    const prefs = (user?.preferences as any) || {};
    const { rootKey, availableOrderByProjectIdKey } = this.getPreferencePath();

    const order = prefs?.[rootKey]?.[availableOrderByProjectIdKey]?.[projectId];
    if (!Array.isArray(order)) return [];

    return order.filter((id: unknown): id is string => typeof id === 'string');
  }

  private async setAvailableOrderToPreferences(params: {
    userId: string;
    projectId: string;
    ids: string[];
  }): Promise<void> {
    const { userId, projectId, ids } = params;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });

    const currentPreferences = (user?.preferences as any) || {};
    const { rootKey, availableOrderByProjectIdKey } = this.getPreferencePath();

    const nextPreferences = {
      ...currentPreferences,
      [rootKey]: {
        ...(currentPreferences?.[rootKey] || {}),
        [availableOrderByProjectIdKey]: {
          ...(currentPreferences?.[rootKey]?.[availableOrderByProjectIdKey] || {}),
          [projectId]: ids,
        },
      },
    };

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        preferences: JSON.parse(JSON.stringify(nextPreferences)),
      },
    });
  }

  // ─── System templates ───────────────────────────────────────────────

  /**
   * Returns all system templates with hidden state for the given user.
   */
  async getSystemTemplates(userId: string, includeHidden = false) {
    const hiddenRecords = await this.prisma.llmSystemPromptHidden.findMany({
      where: { userId },
      select: { systemTemplateId: true },
    });

    const hiddenIds = new Set(hiddenRecords.map(r => r.systemTemplateId));

    return SYSTEM_LLM_PROMPT_TEMPLATES.map(tpl => ({
      id: tpl.id,
      isSystem: true,
      isHidden: hiddenIds.has(tpl.id),
      name: tpl.name,
      note: tpl.note,
      prompt: tpl.prompt,
      category: tpl.category,
    })).filter(tpl => includeHidden || !tpl.isHidden);
  }

  /**
   * Hides a system template for the given user (per-user state).
   */
  async hideSystemTemplate(userId: string, systemTemplateId: string) {
    const exists = SYSTEM_LLM_PROMPT_TEMPLATES.some(t => t.id === systemTemplateId);
    if (!exists) {
      throw new NotFoundException('System template not found');
    }

    await this.prisma.llmSystemPromptHidden.upsert({
      where: {
        userId_systemTemplateId: { userId, systemTemplateId },
      },
      create: {
        id: crypto.randomUUID(),
        userId,
        systemTemplateId,
      },
      update: {},
    });

    return { success: true };
  }

  /**
   * Unhides a system template for the given user.
   */
  async unhideSystemTemplate(userId: string, systemTemplateId: string) {
    const exists = SYSTEM_LLM_PROMPT_TEMPLATES.some(t => t.id === systemTemplateId);
    if (!exists) {
      throw new NotFoundException('System template not found');
    }

    await this.prisma.llmSystemPromptHidden.deleteMany({
      where: { userId, systemTemplateId },
    });

    return { success: true };
  }

  // ─── Available templates (aggregated) ───────────────────────────────

  /**
   * Returns all available templates for the user grouped by source.
   * System templates exclude hidden ones. User/project templates exclude hidden ones.
   */
  async getAvailableTemplatesForUser(params: { userId: string; projectId?: string }) {
    const { userId, projectId } = params;

    const [systemTemplates, userTemplates] = await Promise.all([
      this.getSystemTemplates(userId, false),
      this.findAllByUser(userId, false),
    ]);

    let projectTemplates: Awaited<ReturnType<typeof this.findAllByProject>> = [];
    let order: string[] = [];
    if (projectId) {
      await this.permissionsService.checkProjectAccess(projectId, userId);
      projectTemplates = await this.findAllByProject(projectId, false);

      const rawOrder = await this.getAvailableOrderFromPreferences({ userId, projectId });
      const availableIds = new Set(
        [...systemTemplates, ...userTemplates, ...projectTemplates].map(t => String(t.id)),
      );
      order = rawOrder.filter(id => availableIds.has(id));
    }

    return {
      system: systemTemplates,
      user: userTemplates,
      project: projectTemplates,
      order,
    };
  }

  async setAvailableOrder(params: { userId: string; projectId: string; ids: string[] }) {
    const { userId, projectId, ids } = params;

    await this.permissionsService.checkProjectAccess(projectId, userId);

    const uniqueIds = [
      ...new Set(ids.filter(id => typeof id === 'string' && id.trim().length > 0)),
    ];

    // Keep only ids that are actually available for this user/project (defensive against stale UI state)
    const available = await this.getAvailableTemplatesForUser({ userId, projectId });
    const availableIds = new Set(
      [...available.system, ...available.user, ...available.project].map(t => String(t.id)),
    );
    const normalizedIds = uniqueIds.filter(id => availableIds.has(id));
    await this.setAvailableOrderToPreferences({ userId, projectId, ids: normalizedIds });

    return { success: true };
  }

  // ─── CRUD for user/project templates ────────────────────────────────

  /**
   * Creates a new LLM prompt template for either a user or a project.
   */
  async create(createDto: CreateLlmPromptTemplateDto) {
    if (createDto.userId && createDto.projectId) {
      throw new BadRequestException('Cannot specify both userId and projectId');
    }

    if (!createDto.userId && !createDto.projectId) {
      throw new BadRequestException('Must specify either userId or projectId');
    }

    if (createDto.prompt.length > MAX_PROMPT_LENGTH) {
      throw new BadRequestException(
        `Prompt is too long. Maximum length is ${MAX_PROMPT_LENGTH} characters`,
      );
    }

    let order = createDto.order ?? 0;
    if (order === 0) {
      const maxOrder = await this.getMaxOrder(createDto.userId, createDto.projectId);
      order = maxOrder + 1;
    }

    return this.prisma.llmPromptTemplate.create({
      data: {
        ...createDto,
        name: createDto.name?.trim() || null,
        order,
      },
    });
  }

  private async getMaxOrder(userId?: string, projectId?: string): Promise<number> {
    const result = await this.prisma.llmPromptTemplate.aggregate({
      where: userId ? { userId } : { projectId },
      _max: { order: true },
    });

    return result._max.order ?? -1;
  }

  /**
   * Retrieves all personal templates for a specific user.
   */
  async findAllByUser(userId: string, includeHidden = false) {
    return this.prisma.llmPromptTemplate.findMany({
      where: {
        userId,
        ...(includeHidden ? {} : { isHidden: false }),
      },
      orderBy: { order: 'asc' },
    });
  }

  /**
   * Retrieves all project-specific templates for a specific project.
   */
  async findAllByProject(projectId: string, includeHidden = false) {
    return this.prisma.llmPromptTemplate.findMany({
      where: {
        projectId,
        ...(includeHidden ? {} : { isHidden: false }),
      },
      orderBy: { order: 'asc' },
    });
  }

  async findOne(id: string) {
    const template = await this.prisma.llmPromptTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }

    return template;
  }

  async update(id: string, updateDto: UpdateLlmPromptTemplateDto) {
    await this.findOne(id);

    if (updateDto.prompt && updateDto.prompt.length > MAX_PROMPT_LENGTH) {
      throw new BadRequestException(
        `Prompt is too long. Maximum length is ${MAX_PROMPT_LENGTH} characters`,
      );
    }

    return this.prisma.llmPromptTemplate.update({
      where: { id },
      data: {
        ...updateDto,
        name: updateDto.name !== undefined ? updateDto.name?.trim() || null : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.llmPromptTemplate.delete({
      where: { id },
    });
  }

  // ─── Hide / Unhide for user/project templates ──────────────────────

  async hideTemplate(id: string) {
    await this.findOne(id);

    return this.prisma.llmPromptTemplate.update({
      where: { id },
      data: { isHidden: true },
    });
  }

  async unhideTemplate(id: string) {
    await this.findOne(id);

    return this.prisma.llmPromptTemplate.update({
      where: { id },
      data: { isHidden: false },
    });
  }

  // ─── Reorder ────────────────────────────────────────────────────────

  async reorder(ids: string[], userId: string) {
    if (ids.length === 0) {
      return { success: true };
    }

    const templates = await this.prisma.llmPromptTemplate.findMany({
      where: { id: { in: ids } },
      include: {
        project: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
      },
    });

    if (templates.length !== ids.length) {
      throw new NotFoundException('One or more templates not found');
    }

    const firstTemplate = templates[0];
    const isUserScope = !!firstTemplate.userId;
    const scopeId = isUserScope ? firstTemplate.userId : firstTemplate.projectId;

    for (const template of templates) {
      const templateScopeId = isUserScope ? template.userId : template.projectId;

      if (templateScopeId !== scopeId) {
        throw new BadRequestException('Cannot reorder templates from different scopes');
      }

      if (isUserScope) {
        if (template.userId !== userId) {
          throw new ForbiddenException('You do not have permission to reorder these templates');
        }
      } else {
        const isMember = template.project?.members && template.project.members.length > 0;
        const isOwner = template.project?.ownerId === userId;

        if (!isMember && !isOwner) {
          throw new ForbiddenException('You do not have permission to reorder these templates');
        }
      }
    }

    const updates = ids.map((id, index) =>
      this.prisma.llmPromptTemplate.update({
        where: { id },
        data: { order: index },
      }),
    );

    await this.prisma.$transaction(updates);

    return { success: true };
  }

  // ─── Ownership verification ─────────────────────────────────────────

  async verifyOwnership(templateId: string, userId: string): Promise<boolean> {
    const template = await this.prisma.llmPromptTemplate.findUnique({
      where: { id: templateId },
      include: {
        project: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
      },
    });

    if (!template) {
      return false;
    }

    if (template.userId === userId) {
      return true;
    }

    if (template.projectId) {
      const isMember = template.project?.members && template.project.members.length > 0;
      const isOwner = template.project?.ownerId === userId;
      return isMember || isOwner;
    }

    return false;
  }

  // ─── Copy projects list for UI ──────────────────────────────────────

  /**
   * Returns projects where the user can manage prompt templates (owner or has project.update permission).
   */
  async getCopyTargetProjects(userId: string) {
    const projects = await this.prisma.project.findMany({
      where: {
        archivedAt: null,
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      select: {
        id: true,
        name: true,
        ownerId: true,
        members: {
          where: { userId },
          include: { role: true },
        },
      },
    });

    // Filter to only projects where user has project.update permission
    return projects
      .filter(project => {
        if (project.ownerId === userId) return true;
        const member = project.members[0];
        if (!member) return false;
        const permissions = member.role.permissions as any;
        return permissions?.project?.update === true;
      })
      .map(p => ({ id: p.id, name: p.name }));
  }
}
