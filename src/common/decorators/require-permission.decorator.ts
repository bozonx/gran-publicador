import { SetMetadata } from '@nestjs/common';
import type { PermissionKey } from '../types/permissions.types.js';

export const REQUIRE_PERMISSION_KEY = 'require_permission';

/**
 * Decorator to require a specific permission for an endpoint.
 * Requires configuring the PermissionGuard on the controller or method.
 */
export const RequirePermission = (permission: PermissionKey) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permission);
