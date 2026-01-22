import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
import { DEFAULT_ROLE_PERMISSIONS, SYSTEM_ROLE_NAMES } from '../../common/constants/default-permissions.constants.js';
import { SystemRoleType } from '../../common/types/permissions.types.js';

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create default system roles for a new project.
   * Called automatically when a project is created.
   *
   * @param projectId - The ID of the project.
   */
  public async createDefaultRoles(projectId: string): Promise<void> {
    const roles = Object.values(SystemRoleType).map((systemType) => ({
      projectId,
      name: SYSTEM_ROLE_NAMES[systemType],
      isSystem: true,
      systemType,
      permissions: DEFAULT_ROLE_PERMISSIONS[systemType] as any,
    }));

    await this.prisma.role.createMany({
      data: roles,
    });

    this.logger.log(`Created ${roles.length} default roles for project ${projectId}`);
  }

  /**
   * Get all roles for a project.
   * User must have access to the project.
   *
   * @param projectId - The ID of the project.
   * @param userId - The ID of the user.
   * @returns List of roles.
   */
  public async findAll(projectId: string, userId: string) {
    // Check project access
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: {
          where: { userId },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.ownerId !== userId && project.members.length === 0) {
      throw new ForbiddenException('You do not have access to this project');
    }

    const roles = await this.prisma.role.findMany({
      where: { projectId },
      orderBy: [
        { isSystem: 'desc' }, // System roles first
        { name: 'asc' },
      ],
    });

    return roles.map((role) => ({
      ...role,
      permissions: role.permissions as any,
    }));
  }

  /**
   * Get a single role by ID.
   *
   * @param id - The ID of the role.
   * @param userId - The ID of the user.
   * @returns The role.
   */
  public async findOne(id: string, userId: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
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

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // Check access
    if (role.project.ownerId !== userId && role.project.members.length === 0) {
      throw new ForbiddenException('You do not have access to this role');
    }

    return {
      ...role,
      permissions: role.permissions as any,
    };
  }

  /**
   * Create a custom role.
   * Only project owner can create roles.
   *
   * @param projectId - The ID of the project.
   * @param userId - The ID of the user.
   * @param data - The role data.
   * @returns The created role.
   */
  public async create(projectId: string, userId: string, data: CreateRoleDto) {
    // Check if user is project owner
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.ownerId !== userId) {
      throw new ForbiddenException('Only project owner can create roles');
    }

    // Check if role name already exists
    const existing = await this.prisma.role.findUnique({
      where: {
        projectId_name: {
          projectId,
          name: data.name,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('Role with this name already exists');
    }

    const role = await this.prisma.role.create({
      data: {
        projectId,
        name: data.name,
        isSystem: false,
        systemType: null,
        permissions: data.permissions as any,
      },
    });

    this.logger.log(`Custom role "${role.name}" created for project ${projectId} by user ${userId}`);

    return {
      ...role,
      permissions: role.permissions as any,
    };
  }

  /**
   * Update a role (system or custom).
   * Only project owner can update roles.
   *
   * @param id - The ID of the role.
   * @param userId - The ID of the user.
   * @param data - The update data.
   * @returns The updated role.
   */
  public async update(id: string, userId: string, data: UpdateRoleDto) {
    const role = await this.findOne(id, userId);

    // Check if user is project owner
    if (role.project.ownerId !== userId) {
      throw new ForbiddenException('Only project owner can update roles');
    }

    // If updating name, check uniqueness
    if (data.name && data.name !== role.name) {
      const existing = await this.prisma.role.findUnique({
        where: {
          projectId_name: {
            projectId: role.projectId,
            name: data.name,
          },
        },
      });

      if (existing) {
        throw new BadRequestException('Role with this name already exists');
      }
    }

    const updated = await this.prisma.role.update({
      where: { id },
      data: {
        name: data.name,
        permissions: data.permissions ? (data.permissions as any) : undefined,
      },
    });

    this.logger.log(`Role "${updated.name}" updated for project ${role.projectId} by user ${userId}`);

    return {
      ...updated,
      permissions: updated.permissions as any,
    };
  }

  /**
   * Delete a custom role.
   * Only project owner can delete roles.
   * System roles cannot be deleted.
   *
   * @param id - The ID of the role.
   * @param userId - The ID of the user.
   */
  public async remove(id: string, userId: string) {
    const role = await this.findOne(id, userId);

    // Check if user is project owner
    if (role.project.ownerId !== userId) {
      throw new ForbiddenException('Only project owner can delete roles');
    }

    // Cannot delete system roles
    if (role.isSystem) {
      throw new BadRequestException('Cannot delete system roles');
    }

    // Check if role is assigned to any members
    const membersCount = await this.prisma.projectMember.count({
      where: { roleId: id },
    });

    if (membersCount > 0) {
      throw new BadRequestException(
        `Cannot delete role "${role.name}" because it is assigned to ${membersCount} member(s)`,
      );
    }

    await this.prisma.role.delete({
      where: { id },
    });

    this.logger.log(`Custom role "${role.name}" deleted from project ${role.projectId} by user ${userId}`);
  }

  /**
   * Get a role by project and system type.
   * Used internally for assigning default roles.
   *
   * @param projectId - The ID of the project.
   * @param systemType - The system role type.
   * @returns The role or null.
   */
  public async findBySystemType(projectId: string, systemType: SystemRoleType) {
    return this.prisma.role.findFirst({
      where: {
        projectId,
        isSystem: true,
        systemType,
      },
    });
  }
}
