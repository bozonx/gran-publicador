import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsService } from '../services/permissions.service.js';
import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator.js';
import { PermissionKey } from '../types/permissions.types.js';
import { PrismaService } from '../../modules/prisma/prisma.service.js';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionsService: PermissionsService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.getAllAndOverride<PermissionKey>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermission) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const user = req.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const projectId = await this.resolveProjectId(req);

    if (projectId) {
      await this.permissionsService.checkPermission(projectId, user.userId, requiredPermission);
    } else {
      throw new ForbiddenException('Project context is missing for this action');
    }

    return true;
  }

  private async resolveProjectId(req: any): Promise<string | null> {
    if (req.body?.projectId) return req.body.projectId;
    if (req.query?.projectId) return req.query.projectId;
    if (req.params?.projectId) return req.params.projectId;

    const id = req.params?.id;
    if (id) {
      const path = req.route?.path || req.url;
      if (path.includes('/channels/')) {
        const channel = await this.prisma.channel.findUnique({
          where: { id },
          select: { projectId: true },
        });
        return channel?.projectId || null;
      }
      if (path.includes('/projects/')) {
        return id;
      }
      if (path.includes('/publications/')) {
        const pub = await this.prisma.publication.findUnique({
          where: { id },
          select: { projectId: true },
        });
        return pub?.projectId || null;
      }
    }

    return null;
  }
}
