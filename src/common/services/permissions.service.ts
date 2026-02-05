import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../modules/prisma/prisma.service.js';
import { RolePermissions, PermissionKey, SystemRoleType } from '../types/permissions.types.js';

/**
 * Centralized service for checking project access and granular permissions.
 */
@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Check if a user has access to a project.
   * Access is granted if the user is a global admin, the owner, or a member.
   * Throws ForbiddenException if project is archived and allowArchived is false.
   */
  public async checkProjectAccess(
    projectId: string,
    userId: string,
    allowArchived = true,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });

    if (user?.isAdmin) return;

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        ownerId: true,
        archivedAt: true,
        members: {
          where: { userId },
          select: { id: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Check strict access first
    if (project.ownerId !== userId && project.members.length === 0) {
      throw new ForbiddenException('You do not have access to this project');
    }

    // Check archived status if required
    if (!allowArchived && project.archivedAt) {
      throw new ForbiddenException('Project is archived. Restore it to perform this action.');
    }
  }

  /**
   * Get granular permissions for a user in a project.
   * Global Admins and Project Owners get full permissions.
   */
  public async getUserPermissions(
    projectId: string,
    userId: string,
  ): Promise<RolePermissions | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });

    if (user?.isAdmin) {
      return this.getFullPermissions();
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: {
          where: { userId },
          include: { role: true },
        },
      },
    });

    if (!project) return null;

    // Owner has all permissions
    if (project.ownerId === userId) {
      return this.getFullPermissions();
    }

    if (project.members.length === 0) return null;

    return project.members[0].role.permissions as unknown as RolePermissions;
  }

  /**
   * Check if user has a specific permission in the project.
   * Also checks if project is archived for mutation operations (create, update, delete).
   */
  public async checkPermission(
    projectId: string,
    userId: string,
    permissionKey: PermissionKey,
  ): Promise<void> {
    const isMutation =
      permissionKey.includes('create') ||
      permissionKey.includes('update') ||
      permissionKey.includes('delete');

    // Basic access check (handling global admin internally)
    await this.checkProjectAccess(projectId, userId, !isMutation);

    const permissions = await this.getUserPermissions(projectId, userId);

    if (!permissions) {
      // Should have been caught by checkProjectAccess, but double check
      throw new ForbiddenException('No access to project');
    }

    const [category, action] = permissionKey.split('.') as [keyof RolePermissions, string];
    const hasPermission = (permissions[category] as any)?.[action] === true;

    if (!hasPermission) {
      throw new ForbiddenException(`Missing permission: ${permissionKey}`);
    }
  }

  /**
   * Legacy method for backward compatibility - DEPRECATED.
   * Prefer using checkPermission with granular keys.
   */
  public async checkProjectPermission(
    projectId: string,
    userId: string,
    allowedRoles: string[],
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });

    if (user?.isAdmin) return;

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: {
          where: { userId },
          include: { role: true },
        },
      },
    });

    if (!project) throw new NotFoundException('Project not found');
    if (project.ownerId === userId) return;

    if (project.members.length === 0) {
      throw new ForbiddenException('No access to project');
    }

    const userRole = project.members[0].role;

    const isAllowed = allowedRoles.some(
      r =>
        userRole.systemType === r ||
        (r === 'ADMIN' && userRole.systemType === SystemRoleType.ADMIN),
    );

    if (!isAllowed) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  /**
   * Retrieve the user's role name or 'OWNER'.
   */
  public async getUserProjectRole(projectId: string, userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        ownerId: true,
        members: {
          where: { userId },
          include: { role: true },
        },
      },
    });

    if (!project) return null;
    if (project.ownerId === userId) return 'OWNER';
    if (user?.isAdmin) return 'ADMIN (Global)';
    if (project.members.length === 0) return null;

    return project.members[0].role.systemType || project.members[0].role.name;
  }

  private getFullPermissions(): RolePermissions {
    return {
      project: { read: true, update: true },
      channels: { read: true, create: true, update: true, delete: true },
      publications: {
        read: true,
        create: true,
        updateOwn: true,
        updateAll: true,
        deleteOwn: true,
        deleteAll: true,
      },
    };
  }
}
