import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AuthorSignaturesService } from '../author-signatures.service.js';

/**
 * Guard to verify that the current user has access to a signature.
 * Accessible to the creator, project owner, or project admin.
 */
@Injectable()
export class SignatureAccessGuard implements CanActivate {
  constructor(private readonly authorSignaturesService: AuthorSignaturesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const signatureId = request.params.id;

    if (!user?.id) {
      throw new ForbiddenException('User not authenticated');
    }

    if (!signatureId) {
      return true;
    }

    const hasAccess = await this.authorSignaturesService.checkAccess(signatureId, user.id);

    if (!hasAccess) {
      throw new ForbiddenException('You do not have permission to access this signature');
    }

    return true;
  }
}
