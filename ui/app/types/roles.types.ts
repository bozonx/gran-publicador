export type PermissionKey =
  | 'project.read'
  | 'project.update'
  | 'channels.read'
  | 'channels.create'
  | 'channels.update'
  | 'channels.delete'
  | 'publications.read'
  | 'publications.create'
  | 'publications.updateOwn'
  | 'publications.updateAll'
  | 'publications.deleteOwn'
  | 'publications.deleteAll'

export interface RolePermissions {
  project: {
    read: boolean
    update: boolean
  }
  channels: {
    read: boolean
    create: boolean
    update: boolean
    delete: boolean
  }
  publications: {
    read: boolean
    create: boolean
    updateOwn: boolean
    updateAll: boolean
    deleteOwn: boolean
    deleteAll: boolean
  }
}

export enum SystemRoleType {
  ADMIN = 'ADMIN',
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER',
}

export interface Role {
  id: string
  projectId: string
  name: string
  isSystem: boolean
  systemType: SystemRoleType | null
  permissions: RolePermissions
  createdAt: string
  updatedAt: string
}

export interface RoleWithMemberCount extends Role {
  memberCount?: number
  members?: { id: string }[]
  _count?: {
    members: number
  }
}
