import { type RolePermissions, SystemRoleType } from '../types/permissions.types.js';

export const DEFAULT_ROLE_PERMISSIONS: Record<SystemRoleType, RolePermissions> = {
  [SystemRoleType.VIEWER]: {
    project: { read: true, update: false },
    channels: { read: true, create: false, update: false, delete: false },
    publications: {
      read: true,
      create: false,
      updateOwn: false,
      updateAll: false,
      deleteOwn: false,
      deleteAll: false,
    },
    contentLibrary: { read: true, create: false, update: false, delete: false },
  },
  [SystemRoleType.EDITOR]: {
    project: { read: true, update: false },
    channels: { read: true, create: true, update: true, delete: true },
    publications: {
      read: true,
      create: true,
      updateOwn: true,
      updateAll: true,
      deleteOwn: true,
      deleteAll: true,
    },
    contentLibrary: { read: true, create: true, update: true, delete: true },
  },
  [SystemRoleType.ADMIN]: {
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
    contentLibrary: { read: true, create: true, update: true, delete: true },
  },
};

export const SYSTEM_ROLE_NAMES: Record<SystemRoleType, string> = {
  [SystemRoleType.ADMIN]: 'Admin',
  [SystemRoleType.EDITOR]: 'Editor',
  [SystemRoleType.VIEWER]: 'Viewer',
};
