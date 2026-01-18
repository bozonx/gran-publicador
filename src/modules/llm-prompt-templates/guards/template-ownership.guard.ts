import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

/**
 * Guard to verify that the current user owns or has access to a template.
 * Used for update, delete, and reorder operations.
 */
@Injectable()
export class TemplateOwnershipGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const templateId = request.params.id;

    if (!user?.id) {
      throw new ForbiddenException('User not authenticated');
    }

    if (!templateId) {
      // For reorder operation, validation is done in the service
      return true;
    }

    const template = await this.prisma.llmPromptTemplate.findUnique({
      where: { id: templateId },
      include: {
        project: {
          include: {
            members: {
              where: { userId: user.id },
            },
          },
        },
      },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    // Check if user owns the template (personal template)
    if (template.userId === user.id) {
      return true;
    }

    // Check if user has access to the project (project template)
    if (template.projectId) {
      const isMember = template.project?.members && template.project.members.length > 0;
      const isOwner = template.project?.ownerId === user.id;

      if (isMember || isOwner) {
        return true;
      }
    }

    throw new ForbiddenException('You do not have permission to access this template');
  }
}
