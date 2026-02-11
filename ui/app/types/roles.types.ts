export { PermissionKey, SystemRoleType } from '@gran/shared/permissions';

export type PermissionKey = import('@gran/shared/permissions').PermissionKey;

export type RolePermissions = import('@gran/shared/permissions').RolePermissions;

export type SystemRoleType = import('@gran/shared/permissions').SystemRoleType;

export interface Role {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
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
