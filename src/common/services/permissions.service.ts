import { ForbiddenException, Injectable } from '@nestjs/common';
import { ProjectRole } from '../../generated/prisma/client.js';

import { PrismaService } from '../../modules/prisma/prisma.service.js';

/**
 * Centralized service for checking project access permissions
 * Eliminates code duplication across multiple services
 */
@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Check if a user has access to a project.
   * Access is granted if the user is the owner or a member with any role.
   *
   * @param projectId - The ID of the project to check access for.
   * @param userId - The ID of the user attempting to access the project.
   * @throws ForbiddenException if the project doesn't exist or the user has no access.
   */
  public async checkProjectAccess(projectId: string, userId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: {
          where: { userId },
          select: { role: true },
        },
      },
    });

    if (!project) {
      throw new ForbiddenException('Project not found');
    }

    if (project.ownerId === userId) {
      return;
    }

    if (project.members.length > 0) {
      return;
    }

    throw new ForbiddenException('You do not have access to this project');
  }

  /**
   * Check if a user has specific permissions within a project.
   * The project owner is always granted access.
   * Member access depends on their role being in the allowedRoles list.
   *
   * @param projectId - The ID of the project.
   * @param userId - The ID of the user.
   * @param allowedRoles - An array of roles that are permitted to perform the action.
   * @throws ForbiddenException if project not found or permission denied.
   */
  public async checkProjectPermission(
    projectId: string,
    userId: string,
    allowedRoles: ProjectRole[],
  ): Promise<void> {
    // First check if user is owner
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true },
    });

    if (!project) {
      throw new ForbiddenException('Project not found');
    }

    // Owner always has access
    if (project.ownerId === userId) {
      return;
    }

    // Check membership role
    const membership = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId },
      },
    });

    if (!membership || !allowedRoles.includes(membership.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  /**
   * Retrieve the user's role in a specific project.
   *
   * @param projectId - The ID of the project.
   * @param userId - The ID of the user.
   * @returns 'OWNER' if the user is the owner, the MemberRole if they are a member, or null if unrelated.
   */
  public async getUserProjectRole(projectId: string, userId: string): Promise<ProjectRole | null> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true },
    });

    if (!project) {
      return null;
    }

    // Check if user is owner
    if (project.ownerId === userId) {
      return ProjectRole.OWNER;
    }

    // Check membership
    const membership = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId },
      },
    });

    return membership?.role ?? null;
  }
}
