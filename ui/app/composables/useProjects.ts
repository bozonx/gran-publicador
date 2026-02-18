import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useProjectsStore } from '~/stores/projects';
import type { Project, ProjectWithRole, ProjectMemberWithUser } from '~/stores/projects';
import { ArchiveEntityType } from '~/types/archive.types';
import { logger } from '~/utils/logger';
import { applyArchiveQueryFlags } from '~/utils/archive-query';

export function useProjects() {
  const api = useApi();
  const { user } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const { archiveEntity, restoreEntity } = useArchive();

  const store = useProjectsStore();
  const { projects, currentProject, members, isLoading, error } = storeToRefs(store);

  async function fetchProjects(arg?: boolean | {
    includeArchived?: boolean;
    hasContentCollections?: boolean;
  }): Promise<ProjectWithRole[]> {
    store.setLoading(true);
    store.setError(null);

    try {
      const options = typeof arg === 'object' ? arg : { includeArchived: arg };
      const params: any = { limit: 100 };
      applyArchiveQueryFlags(params, { includeArchived: options.includeArchived });
      if (options.hasContentCollections) {
        params.hasContentCollections = true;
      }
      const data = await api.get<ProjectWithRole[]>('/projects', { params });
      store.setProjects(data);
      return data;
    } catch (err: any) {
      const message = err.message || 'Failed to fetch projects';
      store.setError(message);
      toast.add({
        title: t('common.error'),
        description: message,
        color: 'error',
      });
      return [];
    } finally {
      store.setLoading(false);
    }
  }

  async function fetchArchivedProjects(): Promise<ProjectWithRole[]> {
    store.setLoading(true);
    store.setError(null);

    try {
      const data = await api.get<ProjectWithRole[]>('/projects/archived');
      return data;
    } catch (err: any) {
      const message = err.message || 'Failed to fetch archived projects';
      store.setError(message);
      toast.add({
        title: t('common.error'),
        description: message,
        color: 'error',
      });
      return [];
    } finally {
      store.setLoading(false);
    }
  }

  async function fetchProject(projectId: string): Promise<ProjectWithRole | null> {
    store.setLoading(true);
    store.setError(null);

    try {
      const data = await api.get<ProjectWithRole>(`/projects/${projectId}`);
      store.setCurrentProject(data);
      return data;
    } catch (err: any) {
      const message = err.message || 'Failed to fetch project';
      store.setError(message);
      toast.add({
        title: t('common.error'),
        description: message,
        color: 'error',
      });
      return null;
    } finally {
      store.setLoading(false);
    }
  }

  async function createProject(data: {
    name: string;
    description?: string;
  }): Promise<Project | null> {
    store.setLoading(true);
    store.setError(null);

    try {
      const project = await api.post<Project>('/projects', data);
      toast.add({
        title: t('common.success'),
        description: t('project.createSuccess'),
        color: 'success',
      });
      await fetchProjects();
      return project;
    } catch (err: any) {
      const message = err.message || 'Failed to create project';
      store.setError(message);
      toast.add({
        title: t('common.error'),
        description: message,
        color: 'error',
      });
      return null;
    } finally {
      store.setLoading(false);
    }
  }

  async function updateProject(
    projectId: string,
    data: Partial<Project>,
    options: { silent?: boolean } = {},
  ): Promise<Project | null> {
    store.setLoading(true);
    store.setError(null);

    try {
      const updatedProject = await api.patch<Project>(`/projects/${projectId}`, data);
      if (!options.silent) {
        toast.add({
          title: t('common.success'),
          description: t('project.updateSuccess'),
          color: 'success',
        });
      }
      store.updateProject(projectId, updatedProject as ProjectWithRole);
      return updatedProject;
    } catch (err: any) {
      const message = err.message || 'Failed to update project';
      store.setError(message);
      if (!options.silent) {
        toast.add({
          title: t('common.error'),
          description: message,
          color: 'error',
        });
      }
      return null;
    } finally {
      store.setLoading(false);
    }
  }

  async function deleteProject(projectId: string): Promise<boolean> {
    store.setLoading(true);
    store.setError(null);

    try {
      await api.delete(`/projects/${projectId}`);
      toast.add({
        title: t('common.success'),
        description: t('project.deleteSuccess'),
        color: 'success',
      });
      store.removeProject(projectId);
      return true;
    } catch (err: any) {
      const message = err.message || 'Failed to delete project';
      store.setError(message);
      toast.add({
        title: t('common.error'),
        description: message,
        color: 'error',
      });
      return false;
    } finally {
      store.setLoading(false);
    }
  }

  async function archiveProject(projectId: string): Promise<Project | null> {
    store.setLoading(true);
    store.setError(null);

    try {
      await archiveEntity(ArchiveEntityType.PROJECT, projectId);
      // Refetch project to get updated state
      const updatedProject = await fetchProject(projectId);

      // Explicitly update the project in the list or remove it if we want it gone immediately
      if (updatedProject) {
        store.updateProject(projectId, updatedProject);
      }

      return store.currentProject;
    } catch (err: any) {
      // Error already handled by useArchive
      return null;
    } finally {
      store.setLoading(false);
    }
  }

  async function unarchiveProject(projectId: string): Promise<Project | null> {
    store.setLoading(true);
    store.setError(null);

    try {
      await restoreEntity(ArchiveEntityType.PROJECT, projectId);
      const updatedProject = await fetchProject(projectId);

      if (updatedProject) {
        store.updateProject(projectId, updatedProject);
      }

      return store.currentProject;
    } catch (err: any) {
      return null;
    } finally {
      store.setLoading(false);
    }
  }

  async function fetchMembers(projectId: string): Promise<ProjectMemberWithUser[]> {
    store.setLoading(true);
    try {
      const data = await api.get<ProjectMemberWithUser[]>(`/projects/${projectId}/members`);
      store.setMembers(data);
      return data;
    } catch (err: any) {
      logger.error('[useProjects] fetchMembers error', err);
      return [];
    } finally {
      store.setLoading(false);
    }
  }

  async function addMember(projectId: string, username: string, roleId: string): Promise<boolean> {
    store.setLoading(true);
    try {
      await api.post(`/projects/${projectId}/members`, { username, roleId });
      toast.add({
        title: t('common.success'),
        description: t('projectMember.addSuccess'),
        color: 'success',
      });
      await fetchMembers(projectId);
      return true;
    } catch (err: any) {
      const message = err.message || 'Failed to add member';
      toast.add({
        title: t('common.error'),
        description: message,
        color: 'error',
      });
      return false;
    } finally {
      store.setLoading(false);
    }
  }

  async function updateMemberRoleId(
    projectId: string,
    userId: string,
    roleId: string,
  ): Promise<boolean> {
    store.setLoading(true);
    try {
      await api.patch(`/projects/${projectId}/members/${userId}`, { roleId });
      toast.add({
        title: t('common.success'),
        description: t('projectMember.updateSuccess'),
        color: 'success',
      });
      await fetchMembers(projectId);
      return true;
    } catch (err: any) {
      const message = err.message || 'Failed to update member role';
      toast.add({
        title: t('common.error'),
        description: message,
        color: 'error',
      });
      return false;
    } finally {
      store.setLoading(false);
    }
  }

  async function removeMember(projectId: string, userId: string): Promise<boolean> {
    store.setLoading(true);
    try {
      await api.delete(`/projects/${projectId}/members/${userId}`);
      toast.add({
        title: t('common.success'),
        description: t('projectMember.removeSuccess'),
        color: 'success',
      });
      await fetchMembers(projectId);
      return true;
    } catch (err: any) {
      const message = err.message || 'Failed to remove member';
      toast.add({
        title: t('common.error'),
        description: message,
        color: 'error',
      });
      return false;
    } finally {
      store.setLoading(false);
    }
  }

  function canEdit(project: ProjectWithRole): boolean {
    if (!user.value) return false;
    return (
      project.ownerId === user.value.id || project.role === 'owner' || project.role === 'admin'
    );
  }

  function canDelete(project: ProjectWithRole): boolean {
    if (!user.value) return false;
    return (
      project.ownerId === user.value.id || project.role === 'owner' || project.role === 'admin'
    );
  }

  function canManageMembers(project: ProjectWithRole): boolean {
    return canEdit(project);
  }

  function clearCurrentProject() {
    store.setCurrentProject(null);
    store.setError(null);
  }

  function getProjectProblems(project: Project | any) {
    const problems: Array<{ type: 'critical' | 'warning'; key: string; count?: number }> = [];

    // Check for critical failures (failed posts)
    if (project.failedPostsCount > 0) {
      problems.push({
        type: 'critical',
        key: 'failedPosts',
        count: project.failedPostsCount,
      });
    }

    // Check for problem publications (critical)
    if (project.problemPublicationsCount > 0) {
      problems.push({
        type: 'critical',
        key: 'problemPublications',
        count: project.problemPublicationsCount,
      });
    }

    // Check for stale channels (warnings)
    if (project.staleChannelsCount > 0) {
      problems.push({
        type: 'warning',
        key: 'staleChannels',
        count: project.staleChannelsCount,
      });
    }

    // Check for no recent activity (warnings)
    if (project.lastPublicationAt) {
      const lastDate = new Date(project.lastPublicationAt).getTime();
      const now = new Date().getTime();
      const diffDays = (now - lastDate) / (1000 * 60 * 60 * 24);

      if (diffDays > 3) {
        problems.push({ type: 'warning', key: 'noRecentActivity' });
      }
    }

    // Check for channels without credentials (critical)
    if (project.noCredentialsChannelsCount > 0) {
      problems.push({
        type: 'critical',
        key: 'noCredentials',
        count: project.noCredentialsChannelsCount,
      });
    }

    // Check for inactive channels (warning)
    if (project.inactiveChannelsCount > 0) {
      problems.push({
        type: 'warning',
        key: 'inactiveChannels',
        count: project.inactiveChannelsCount,
      });
    }

    // Check for no channels (critical)
    if (project.channelCount === 0) {
      problems.push({
        type: 'critical',
        key: 'noChannels',
      });
    }

    return problems;
  }

  function getProjectProblemLevel(project: Project | any): 'critical' | 'warning' | null {
    if (!project) return null;
    const problems = getProjectProblems(project);
    if (problems.some(p => p.type === 'critical')) return 'critical';
    if (problems.some(p => p.type === 'warning')) return 'warning';
    return null;
  }

  async function transferProject(
    projectId: string,
    data: { targetUserId: string; projectName: string; clearCredentials: boolean },
  ): Promise<boolean> {
    store.setLoading(true);
    store.setError(null);

    try {
      await api.post(`/projects/${projectId}/transfer`, data);
      toast.add({
        title: t('common.success'),
        description: t('project.transferSuccess', 'Project transferred successfully'),
        color: 'success',
      });
      await fetchProjects();
      return true;
    } catch (err: any) {
      const message = err.message || 'Failed to transfer project';
      store.setError(message);
      toast.add({
        title: t('common.error'),
        description: message,
        color: 'error',
      });
      return false;
    } finally {
      store.setLoading(false);
    }
  }

  async function updateProjectOrder(order: string[]): Promise<boolean> {
    if (!user.value) return false;

    try {
      await api.patch('/users/me', { projectOrder: order });
      if (user.value) {
        user.value.projectOrder = order;
      }
      return true;
    } catch (err: any) {
      logger.error('Failed to update project order', err);
      return false;
    }
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
    transferProject,
    updateProjectOrder,
    clearCurrentProject,
    fetchMembers,
    addMember,
    updateMemberRoleId,
    removeMember,
    canEdit,
    canDelete,
    archiveProject,
    unarchiveProject,
    canManageMembers,

    // Problem detection
    getProjectProblems,
    getProjectProblemLevel,
  };
}
