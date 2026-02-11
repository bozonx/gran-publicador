export interface RolePermissions {
  project: {
    read: boolean;
    update: boolean;
  };
  channels: {
    read: boolean;
    create: boolean;
    update: boolean;
    delete: boolean;
  };
  publications: {
    read: boolean;
    create: boolean;
    updateOwn: boolean;
    updateAll: boolean;
    deleteOwn: boolean;
    deleteAll: boolean;
  };
}

export const SystemRoleType = {
  ADMIN: 'ADMIN',
  EDITOR: 'EDITOR',
  VIEWER: 'VIEWER',
} as const;

export type SystemRoleType = (typeof SystemRoleType)[keyof typeof SystemRoleType];

export const PermissionKey = {
  PROJECT_READ: 'project.read',
  PROJECT_UPDATE: 'project.update',
  CHANNELS_READ: 'channels.read',
  CHANNELS_CREATE: 'channels.create',
  CHANNELS_UPDATE: 'channels.update',
  CHANNELS_DELETE: 'channels.delete',
  PUBLICATIONS_READ: 'publications.read',
  PUBLICATIONS_CREATE: 'publications.create',
  PUBLICATIONS_UPDATE_OWN: 'publications.updateOwn',
  PUBLICATIONS_UPDATE_ALL: 'publications.updateAll',
  PUBLICATIONS_DELETE_OWN: 'publications.deleteOwn',
  PUBLICATIONS_DELETE_ALL: 'publications.deleteAll',
} as const;

export type PermissionKey = (typeof PermissionKey)[keyof typeof PermissionKey];
