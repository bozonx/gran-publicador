import { PermissionKey, SystemRoleType, type RolePermissions } from '@gran/shared/permissions';

export { PermissionKey, SystemRoleType };
export type { RolePermissions };

export interface Role {
  id: string;
  projectId: string;
  name: string;
  note?: string | null;
  isSystem: boolean;
  systemType: SystemRoleType | null;
  permissions: RolePermissions;
  createdAt: string;
  updatedAt: string;
}

export interface RoleWithMemberCount extends Role {
  memberCount?: number;
  members?: { id: string }[];
  _count?: {
    members: number;
  };
}
