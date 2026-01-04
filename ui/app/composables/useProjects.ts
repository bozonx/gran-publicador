import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useProjectsStore } from '~/stores/projects'
import type { Project, ProjectWithRole, ProjectMemberWithUser, ProjectRole } from '~/stores/projects'
import { ArchiveEntityType } from '~/types/archive.types'

export function useProjects() {
    const api = useApi()
    const { user } = useAuth()
    const { t } = useI18n()
    const toast = useToast()
    const { archiveEntity, restoreEntity } = useArchive()

    const store = useProjectsStore()
    const { projects, currentProject, members, isLoading, error } = storeToRefs(store)

    async function fetchProjects(includeArchived = false): Promise<ProjectWithRole[]> {
        store.setLoading(true)
        store.setError(null)

        try {
            const params = { includeArchived }
            const data = await api.get<ProjectWithRole[]>('/projects', { params })
            store.setProjects(data)
            return data
        } catch (err: any) {
            const message = err.message || 'Failed to fetch projects'
            store.setError(message)
            toast.add({
                title: t('common.error'),
                description: message,
                color: 'error',
            })
            return []
        } finally {
            store.setLoading(false)
        }
    }

    async function fetchArchivedProjects(): Promise<ProjectWithRole[]> {
        store.setLoading(true)
        store.setError(null)

        try {
            const data = await api.get<ProjectWithRole[]>('/projects/archived')
            return data
        } catch (err: any) {
            const message = err.message || 'Failed to fetch archived projects'
            store.setError(message)
            toast.add({
                title: t('common.error'),
                description: message,
                color: 'error',
            })
            return []
        } finally {
            store.setLoading(false)
        }
    }


    async function fetchProject(projectId: string): Promise<ProjectWithRole | null> {
        store.setLoading(true)
        store.setError(null)

        try {
            const data = await api.get<ProjectWithRole>(`/projects/${projectId}`)
            store.setCurrentProject(data)
            return data
        } catch (err: any) {
            const message = err.message || 'Failed to fetch project'
            store.setError(message)
            toast.add({
                title: t('common.error'),
                description: message,
                color: 'error',
            })
            return null
        } finally {
            store.setLoading(false)
        }
    }

    async function createProject(data: { name: string; description?: string }): Promise<Project | null> {
        store.setLoading(true)
        store.setError(null)

        try {
            const project = await api.post<Project>('/projects', data)
            toast.add({
                title: t('common.success'),
                description: t('project.createSuccess'),
                color: 'success',
            })
            await fetchProjects()
            return project
        } catch (err: any) {
            const message = err.message || 'Failed to create project'
            store.setError(message)
            toast.add({
                title: t('common.error'),
                description: message,
                color: 'error',
            })
            return null
        } finally {
            store.setLoading(false)
        }
    }

    async function updateProject(projectId: string, data: Partial<Project>): Promise<Project | null> {
        store.setLoading(true)
        store.setError(null)

        try {
            const updatedProject = await api.patch<Project>(`/projects/${projectId}`, data)
            toast.add({
                title: t('common.success'),
                description: t('project.updateSuccess'),
                color: 'success',
            })
            store.updateProject(projectId, updatedProject as ProjectWithRole)
            return updatedProject
        } catch (err: any) {
            const message = err.message || 'Failed to update project'
            store.setError(message)
            toast.add({
                title: t('common.error'),
                description: message,
                color: 'error',
            })
            return null
        } finally {
            store.setLoading(false)
        }
    }

    async function deleteProject(projectId: string): Promise<boolean> {
        store.setLoading(true)
        store.setError(null)

        try {
            await api.delete(`/projects/${projectId}`)
            toast.add({
                title: t('common.success'),
                description: t('project.deleteSuccess'),
                color: 'success',
            })
            store.removeProject(projectId)
            return true
        } catch (err: any) {
            const message = err.message || 'Failed to delete project'
            store.setError(message)
            toast.add({
                title: t('common.error'),
                description: message,
                color: 'error',
            })
            return false
        } finally {
            store.setLoading(false)
        }
    }

    async function archiveProject(projectId: string): Promise<Project | null> {
        store.setLoading(true)
        store.setError(null)

        try {
            await archiveEntity(ArchiveEntityType.PROJECT, projectId)
            // Ideally we should just update the state, but fetchProject/fetchProjects might be safer
            // to ensure backend state consistency if needed. 
            // For now, let's manual update or re-fetch.
            // But wait, archiveEntity doesn't return the updated entity in a way we can immediately usage?
            // it returns void in composable but the api returns entity.

            // Let's refetch to be safe and simple
            await fetchProject(projectId)

            // Return current project from store
            return store.currentProject
        } catch (err: any) {
            // Error already handled by useArchive
            return null
        } finally {
            store.setLoading(false)
        }
    }

    async function unarchiveProject(projectId: string): Promise<Project | null> {
        store.setLoading(true)
        store.setError(null)

        try {
            await restoreEntity(ArchiveEntityType.PROJECT, projectId)
            await fetchProject(projectId)
            return store.currentProject
        } catch (err: any) {
            return null
        } finally {
            store.setLoading(false)
        }
    }

    async function fetchMembers(projectId: string): Promise<ProjectMemberWithUser[]> {
        store.setLoading(true)
        try {
            const data = await api.get<ProjectMemberWithUser[]>(`/projects/${projectId}/members`)
            store.setMembers(data)
            return data
        } catch (err: any) {
            console.error('[useProjects] fetchMembers error:', err)
            return []
        } finally {
            store.setLoading(false)
        }
    }

    async function addMember(projectId: string, username: string, role: string): Promise<boolean> {
        store.setLoading(true)
        try {
            await api.post(`/projects/${projectId}/members`, { username, role })
            toast.add({
                title: t('common.success'),
                description: t('projectMember.addSuccess'),
                color: 'success',
            })
            await fetchMembers(projectId)
            return true
        } catch (err: any) {
            const message = err.message || 'Failed to add member'
            toast.add({
                title: t('common.error'),
                description: message,
                color: 'error',
            })
            return false
        } finally {
            store.setLoading(false)
        }
    }

    async function updateMemberRole(projectId: string, userId: string, role: string): Promise<boolean> {
        store.setLoading(true)
        try {
            await api.patch(`/projects/${projectId}/members/${userId}`, { role })
            toast.add({
                title: t('common.success'),
                description: t('projectMember.updateSuccess'),
                color: 'success',
            })
            await fetchMembers(projectId)
            return true
        } catch (err: any) {
            const message = err.message || 'Failed to update member role'
            toast.add({
                title: t('common.error'),
                description: message,
                color: 'error',
            })
            return false
        } finally {
            store.setLoading(false)
        }
    }

    async function removeMember(projectId: string, userId: string): Promise<boolean> {
        store.setLoading(true)
        try {
            await api.delete(`/projects/${projectId}/members/${userId}`)
            toast.add({
                title: t('common.success'),
                description: t('projectMember.removeSuccess'),
                color: 'success',
            })
            await fetchMembers(projectId)
            return true
        } catch (err: any) {
            const message = err.message || 'Failed to remove member'
            toast.add({
                title: t('common.error'),
                description: message,
                color: 'error',
            })
            return false
        } finally {
            store.setLoading(false)
        }
    }

    function canEdit(project: ProjectWithRole): boolean {
        if (!user.value) return false
        return project.ownerId === user.value.id || project.role === 'owner' || project.role === 'admin'
    }

    function canDelete(project: ProjectWithRole): boolean {
        if (!user.value) return false
        return project.ownerId === user.value.id || project.role === 'owner' || project.role === 'admin'
    }

    function canManageMembers(project: ProjectWithRole): boolean {
        return canEdit(project)
    }

    function getRoleDisplayName(role: ProjectRole | undefined): string {
        if (!role) return t('roles.viewer')
        return t(`roles.${role}`)
    }

    function clearCurrentProject() {
        store.setCurrentProject(null)
        store.setError(null)
    }

    return {
        projects,
        currentProject,
        members,
        isLoading,
        error,
        fetchProjects,
        fetchArchivedProjects,
        fetchProject,
        createProject,
        updateProject,
        deleteProject,
        clearCurrentProject,
        fetchMembers,
        addMember,
        updateMemberRole,
        removeMember,
        canEdit,
        canDelete,
        archiveProject,
        unarchiveProject,
        canManageMembers,
        getRoleDisplayName,
    }

}
