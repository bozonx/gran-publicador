import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UsersService } from '../../modules/users/users.service.js';

/**
 * Guard that only allows access to users with isAdmin flag.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly usersService: UsersService) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || (!user.sub && !user.id)) {
      return false;
    }

    const userId = user.sub || user.id;
    const dbUser = await this.usersService.findById(userId);

    if (!dbUser?.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
