import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateLlmPromptTemplateDto } from './dto/create-llm-prompt-template.dto.js';
import { UpdateLlmPromptTemplateDto } from './dto/update-llm-prompt-template.dto.js';

const MAX_PROMPT_LENGTH = 5000;

@Injectable()
export class LlmPromptTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new LLM prompt template.
   * Automatically calculates the order field based on existing templates.
   */
  async create(createDto: CreateLlmPromptTemplateDto) {
    // Validate that either userId or projectId is provided, but not both
    if (createDto.userId && createDto.projectId) {
      throw new BadRequestException(
        'Cannot specify both userId and projectId',
      );
    }

    if (!createDto.userId && !createDto.projectId) {
      throw new BadRequestException(
        'Must specify either userId or projectId',
      );
    }

    // Validate prompt length
    if (createDto.prompt.length > MAX_PROMPT_LENGTH) {
      throw new BadRequestException(
        `Prompt is too long. Maximum length is ${MAX_PROMPT_LENGTH} characters`,
      );
    }

    // Auto-calculate order if not provided
    let order = createDto.order ?? 0;
    if (order === 0) {
      const maxOrder = await this.getMaxOrder(
        createDto.userId,
        createDto.projectId,
      );
      order = maxOrder + 1;
    }

    return this.prisma.llmPromptTemplate.create({
      data: {
        ...createDto,
        order,
      },
    });
  }

  /**
   * Gets the maximum order value for a user or project's templates.
   */
  private async getMaxOrder(
    userId?: string,
    projectId?: string,
  ): Promise<number> {
    const result = await this.prisma.llmPromptTemplate.aggregate({
      where: userId ? { userId } : { projectId },
      _max: { order: true },
    });

    return result._max.order ?? -1;
  }

  async findAllByUser(userId: string) {
    return this.prisma.llmPromptTemplate.findMany({
      where: { userId },
      orderBy: { order: 'asc' },
    });
  }

  async findAllByProject(projectId: string) {
    return this.prisma.llmPromptTemplate.findMany({
      where: { projectId },
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

    // Validate prompt length if being updated
    if (updateDto.prompt && updateDto.prompt.length > MAX_PROMPT_LENGTH) {
      throw new BadRequestException(
        `Prompt is too long. Maximum length is ${MAX_PROMPT_LENGTH} characters`,
      );
    }

    return this.prisma.llmPromptTemplate.update({
      where: { id },
      data: updateDto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.llmPromptTemplate.delete({
      where: { id },
    });
  }

  /**
   * Reorders templates by updating their order field.
   * Validates that all templates belong to the same scope (user or project).
   */
  async reorder(ids: string[], userId: string) {
    if (ids.length === 0) {
      return { success: true };
    }

    // Fetch all templates to validate ownership and scope
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

    // Validate that all templates belong to the same scope
    const firstTemplate = templates[0];
    const isUserScope = !!firstTemplate.userId;
    const scopeId = isUserScope
      ? firstTemplate.userId
      : firstTemplate.projectId;

    for (const template of templates) {
      const templateScopeId = isUserScope
        ? template.userId
        : template.projectId;

      if (templateScopeId !== scopeId) {
        throw new BadRequestException(
          'Cannot reorder templates from different scopes',
        );
      }

      // Verify ownership
      if (isUserScope) {
        if (template.userId !== userId) {
          throw new ForbiddenException(
            'You do not have permission to reorder these templates',
          );
        }
      } else {
        // Project template - check membership
        const isMember = template.project?.members && template.project.members.length > 0;
        const isOwner = template.project?.ownerId === userId;

        if (!isMember && !isOwner) {
          throw new ForbiddenException(
            'You do not have permission to reorder these templates',
          );
        }
      }
    }

    // Update order for each template
    const updates = ids.map((id, index) =>
      this.prisma.llmPromptTemplate.update({
        where: { id },
        data: { order: index },
      }),
    );

    await this.prisma.$transaction(updates);

    return { success: true };
  }

  /**
   * Verifies that a user owns or has access to a template.
   * Used by guards and controllers for permission checks.
   */
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

    // Check personal template ownership
    if (template.userId === userId) {
      return true;
    }

    // Check project template access
    if (template.projectId) {
      const isMember = template.project?.members && template.project.members.length > 0;
      const isOwner = template.project?.ownerId === userId;
      return isMember || isOwner;
    }

    return false;
  }
}

