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
   * Access is granted if the user is the owner or a member.
   */
  public async checkProjectAccess(projectId: string, userId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { 
        ownerId: true,
        members: {
          where: { userId },
          select: { id: true }
        }
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.ownerId === userId || project.members.length > 0) {
      return;
    }

    throw new ForbiddenException('You do not have access to this project');
  }

  /**
   * Get granular permissions for a user in a project.
   * Owners get full permissions.
   */
  public async getUserPermissions(projectId: string, userId: string): Promise<RolePermissions | null> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: {
          where: { userId },
          include: { role: true }
        }
      }
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
   */
  public async checkPermission(projectId: string, userId: string, permissionKey: PermissionKey): Promise<void> {
    const permissions = await this.getUserPermissions(projectId, userId);

    if (!permissions) {
      throw new ForbiddenException('No access to project');
    }

    const [category, action] = permissionKey.split('.') as [keyof RolePermissions, string];
    const hasPermission = (permissions[category] as any)?.[action] === true;

    if (!hasPermission) {
      throw new ForbiddenException(`Missing permission: ${permissionKey}`);
    }
  }

  /**
   * Legacy method for backward compatibility. 
   * Maps old ProjectRole values to system types in the new system.
   */
  public async checkProjectPermission(
    projectId: string,
    userId: string,
    allowedRoles: string[], // Previously ProjectRole[]
  ): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: {
          where: { userId },
          include: { role: true }
        }
      }
    });

    if (!project) throw new NotFoundException('Project not found');
    if (project.ownerId === userId) return;

    if (project.members.length === 0) {
      throw new ForbiddenException('No access to project');
    }

    const userRole = project.members[0].role;
    
    // Check if the user's role matches any of the allowed system types
    // or if the user is an admin in the new system
    const isAllowed = allowedRoles.some(r => 
      userRole.systemType === r || 
      (r === 'ADMIN' && userRole.systemType === SystemRoleType.ADMIN)
    );

    if (!isAllowed) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  /**
   * Retrieve the user's role name or 'OWNER'.
   */
  public async getUserProjectRole(
    projectId: string,
    userId: string,
  ): Promise<string | null> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { 
        ownerId: true,
        members: {
          where: { userId },
          include: { role: true }
        }
      },
    });

    if (!project) return null;
    if (project.ownerId === userId) return 'OWNER';
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
      }
    };
  }
}

