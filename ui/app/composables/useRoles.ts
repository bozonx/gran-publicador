import { ref } from 'vue'
import { useApi } from '~/composables/useApi'
import type { Role, RoleWithMemberCount, RolePermissions } from '~/types/roles.types'
import { SystemRoleType } from '~/types/roles.types'

export function useRoles() {
  const api = useApi()
  const { t } = useI18n()
  const toast = useToast()

  const roles = ref<RoleWithMemberCount[]>([])
  const currentRole = ref<Role | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Fetch all roles for a project
   */
  async function fetchRoles(projectId: string): Promise<RoleWithMemberCount[]> {
    isLoading.value = true
    error.value = null

    try {
      // The backend returns roles with member counts or members
      const data = await api.get<RoleWithMemberCount[]>(`/projects/${projectId}/roles`)
      
      // Calculate member count if returned in _count or members array
      const processedData = data.map(role => ({
        ...role,
        memberCount: role.memberCount ?? role._count?.members ?? role.members?.length ?? 0
      }))

      roles.value = processedData
      return processedData
    } catch (err: any) {
      console.error('Error fetching roles:', err)
      error.value = err.message || t('common.error')
      toast.add({
        title: t('common.error'),
        description: t('roles.fetchError', 'Failed to fetch roles'),
        color: 'error'
      })
      return []
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Fetch a single role by ID
   */
  async function fetchRole(roleId: string): Promise<Role | null> {
    isLoading.value = true
    error.value = null

    try {
      const data = await api.get<Role>(`/roles/${roleId}`)
      currentRole.value = data
      return data
    } catch (err: any) {
      console.error('Error fetching role:', err)
      error.value = err.message
      toast.add({
        title: t('common.error'),
        description: t('roles.fetchError', 'Failed to fetch role'),
        color: 'error'
      })
      return null
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Create a new custom role
   */
  async function createRole(projectId: string, data: { name: string; permissions: RolePermissions }): Promise<Role | null> {
    isLoading.value = true
    
    try {
      const newRole = await api.post<Role>(`/projects/${projectId}/roles`, data)
      toast.add({
        title: t('common.success'),
        description: t('roles.createSuccess', 'Role created successfully'),
        color: 'success'
      })
      
      // Refresh list
      await fetchRoles(projectId)
      return newRole
    } catch (err: any) {
      console.error('Error creating role:', err)
      const msg = err.message || t('roles.createError', 'Failed to create role')
      toast.add({
        title: t('common.error'),
        description: msg,
        color: 'error'
      })
      return null
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Update an existing role
   */
  async function updateRole(roleId: string, data: { name?: string; permissions?: RolePermissions }): Promise<Role | null> {
    isLoading.value = true
    
    try {
      const updatedRole = await api.patch<Role>(`/roles/${roleId}`, data)
      toast.add({
        title: t('common.success'),
        description: t('roles.updateSuccess', 'Role updated successfully'),
        color: 'success'
      })
      
      // Update in list if present
      const idx = roles.value.findIndex(r => r.id === roleId)
      if (idx !== -1) {
        roles.value[idx] = { ...roles.value[idx], ...updatedRole }
      }
      
      if (currentRole.value?.id === roleId) {
        currentRole.value = updatedRole
      }
      
      return updatedRole
    } catch (err: any) {
      console.error('Error updating role:', err)
      const msg = err.message || t('roles.updateError', 'Failed to update role')
      toast.add({
        title: t('common.error'),
        description: msg,
        color: 'error'
      })
      return null
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Delete a custom role
   */
  async function deleteRole(roleId: string): Promise<boolean> {
    isLoading.value = true
    
    try {
      await api.delete(`/roles/${roleId}`)
      toast.add({
        title: t('common.success'),
        description: t('roles.deleteSuccess', 'Role deleted successfully'),
        color: 'success'
      })
      
      // Remove from list
      roles.value = roles.value.filter(r => r.id !== roleId)
      if (currentRole.value?.id === roleId) {
        currentRole.value = null
      }
      return true
    } catch (err: any) {
      console.error('Error deleting role:', err)
      const msg = err.message || t('roles.deleteError', 'Failed to delete role')
      toast.add({
        title: t('common.error'),
        description: msg,
        color: 'error'
      })
      return false
    } finally {
      isLoading.value = false
    }
  }
  
  /**
   * Get localized display name for a role
   */
  function getRoleDisplayName(role: Role | string | undefined | null): string {
    if (!role) return t('roles.viewer')
    
    if (typeof role === 'string') {
      const lowerRole = role.toLowerCase()
      // Handle 'owner' specifically as it's not in SystemRoleType but used in project context
      if (['admin', 'editor', 'viewer', 'owner'].includes(lowerRole)) {
        return t(`roles.${lowerRole}`)
      }
      return role
    }
    
    if (role.isSystem && role.systemType) {
      return t(`roles.${role.systemType.toLowerCase()}`)
    }
    
    return role.name
  }

  /**
   * Get badge color for a role
   */
  function getRoleBadgeColor(role: Role | undefined | null): 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral' {
    if (!role) return 'neutral'
    
    if (role.isSystem) {
      switch (role.systemType) {
        case SystemRoleType.ADMIN: return 'secondary'
        case SystemRoleType.EDITOR: return 'info'
        case SystemRoleType.VIEWER: return 'neutral'
      }
    }
    
    return 'primary'
  }

  return {
    roles,
    currentRole,
    isLoading,
    error,
    fetchRoles,
    fetchRole,
    createRole,
    updateRole,
    deleteRole,
    getRoleDisplayName,
    getRoleBadgeColor
  }
}
