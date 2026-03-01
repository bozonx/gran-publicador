import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useProjectsStore } from '~/stores/projects';
import type { Project, ProjectWithRole, ProjectMemberWithUser } from '~/stores/projects';
import { ArchiveEntityType } from '~/types/archive.types';
import { logger } from '~/utils/logger';
import { applyArchiveQueryFlags } from '~/utils/archive-query';
import { PROJECTS_FETCH_LIMIT } from '~/constants';

export function useProjects() {
  const api = useApi();
  const { user } = useAuth();
  const { t } = useI18n();
  const { executeAction } = useApiAction();
  const { archiveEntity, restoreEntity } = useArchive();

  const store = useProjectsStore();
  const { projects, currentProject, members, isLoading, error } = storeToRefs(store);

  // Helper bindings for store state to be used with executeAction
  const loadingBinding = computed({
    get: () => isLoading.value,
    set: (val) => store.setLoading(val)
  });
  const errorBinding = computed({
    get: () => error.value,
    set: (val) => store.setError(val)
  });

  async function fetchProjects(
    arg?:
      | boolean
      | {
          includeArchived?: boolean;
          hasContentCollections?: boolean;
        },
  ): Promise<ProjectWithRole[]> {
    const [, result] = await executeAction(
      async () => {
        const options = typeof arg === 'object' ? arg : { includeArchived: arg };
        const params: Record<string, string | number | boolean | undefined> = { limit: PROJECTS_FETCH_LIMIT };
        applyArchiveQueryFlags(params, { includeArchived: options.includeArchived });
        if (options.hasContentCollections) {
          params.hasContentCollections = true;
        }
        const data = await api.get<ProjectWithRole[]>('/projects', { params });
        store.setProjects(data);
        return data;
      },
      { loadingRef: loadingBinding, errorRef: errorBinding, silentErrors: false }
    );
    return result || [];
  }

  async function fetchArchivedProjects(): Promise<ProjectWithRole[]> {
    const [, result] = await executeAction(
      async () => {
        return await api.get<ProjectWithRole[]>('/projects/archived');
      },
      { loadingRef: loadingBinding, errorRef: errorBinding }
    );
    return result || [];
  }

  async function fetchProject(projectId: string): Promise<ProjectWithRole | null> {
    const [, result] = await executeAction(
      async () => {
        const data = await api.get<ProjectWithRole>(`/projects/${projectId}`);
        store.setCurrentProject(data);
        return data;
      },
      { loadingRef: loadingBinding, errorRef: errorBinding }
    );
    return result;
  }

  async function createProject(data: {
    name: string;
    note?: string;
  }): Promise<Project | null> {
    const [, result] = await executeAction(
      async () => {
        const project = await api.post<Project>('/projects', data);
        await fetchProjects();
        return project;
      },
      { loadingRef: loadingBinding, errorRef: errorBinding, successMessage: t('project.createSuccess') }
    );
    return result;
  }

  async function updateProject(
    projectId: string,
    data: Partial<Project>,
    options: { silent?: boolean } = {},
  ): Promise<Project | null> {
    const [, result] = await executeAction(
      async () => {
        const updatedProject = await api.patch<Project>(`/projects/${projectId}`, data);
        store.updateProject(projectId, updatedProject as ProjectWithRole);
        return updatedProject;
      },
      { 
        loadingRef: loadingBinding, 
        errorRef: errorBinding,
        successMessage: !options.silent ? t('project.updateSuccess') : undefined,
      }
    );
    
    // Explicitly handle conflict refetch
    // Not needed usually, but logic was inside catch
    if (!result && error.value && error.value.includes('409')) {
      fetchProject(projectId);
    }
    
    return result;
  }

  async function deleteProject(projectId: string): Promise<boolean> {
    const [err] = await executeAction(
      async () => {
        await api.delete(`/projects/${projectId}`);
        store.removeProject(projectId);
      },
      { loadingRef: loadingBinding, errorRef: errorBinding, successMessage: t('project.deleteSuccess') }
    );
    return !err;
  }

  async function archiveProject(projectId: string): Promise<Project | null> {
    const [, result] = await executeAction(
      async () => {
        await archiveEntity(ArchiveEntityType.PROJECT, projectId);
        const updatedProject = await fetchProject(projectId);
        if (updatedProject) {
          store.updateProject(projectId, updatedProject);
        }
        return store.currentProject;
      },
      { loadingRef: loadingBinding, errorRef: errorBinding, silentErrors: true } // useArchive already handles errors
    );
    return result;
  }

  async function unarchiveProject(projectId: string): Promise<Project | null> {
    const [, result] = await executeAction(
      async () => {
        await restoreEntity(ArchiveEntityType.PROJECT, projectId);
        const updatedProject = await fetchProject(projectId);
        if (updatedProject) {
          store.updateProject(projectId, updatedProject);
        }
        return store.currentProject;
      },
      { loadingRef: loadingBinding, errorRef: errorBinding, silentErrors: true }
    );
    return result;
  }

  async function fetchMembers(projectId: string): Promise<ProjectMemberWithUser[]> {
    const [, result] = await executeAction(
      async () => {
        const data = await api.get<ProjectMemberWithUser[]>(`/projects/${projectId}/members`);
        store.setMembers(data);
        return data;
      },
      { loadingRef: loadingBinding, silentErrors: true }
    );
    return result || [];
  }

  async function addMember(projectId: string, username: string, roleId: string): Promise<boolean> {
    const [err] = await executeAction(
      async () => {
        await api.post(`/projects/${projectId}/members`, { username, roleId });
        await fetchMembers(projectId);
      },
      { loadingRef: loadingBinding, successMessage: t('projectMember.addSuccess') }
    );
    return !err;
  }

  async function updateMemberRoleId(
    projectId: string,
    userId: string,
    roleId: string,
  ): Promise<boolean> {
    const [err] = await executeAction(
      async () => {
        await api.patch(`/projects/${projectId}/members/${userId}`, { roleId });
        await fetchMembers(projectId);
      },
      { loadingRef: loadingBinding, successMessage: t('projectMember.updateSuccess') }
    );
    return !err;
  }

  async function removeMember(projectId: string, userId: string): Promise<boolean> {
    const [err] = await executeAction(
      async () => {
        await api.delete(`/projects/${projectId}/members/${userId}`);
        await fetchMembers(projectId);
      },
      { loadingRef: loadingBinding, successMessage: t('projectMember.removeSuccess') }
    );
    return !err;
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

  function canTransfer(project: ProjectWithRole): boolean {
    if (!user.value) return false;
    return project.ownerId === user.value.id || project.role === 'owner';
  }

  function canManageMembers(project: ProjectWithRole): boolean {
    return canEdit(project);
  }

  function clearCurrentProject() {
    store.setCurrentProject(null);
    store.setError(null);
  }

  function getProjectProblems(project: ProjectWithRole) {
    const problems: Array<{ type: 'critical' | 'warning'; key: string; count?: number }> = [];
    const counts = {
      failedPosts: project.failedPostsCount || 0,
      problemPublications: project.problemPublicationsCount || 0,
      staleChannels: project.staleChannelsCount || 0,
      noCredentials: project.noCredentialsChannelsCount || 0,
      inactiveChannels: project.inactiveChannelsCount || 0,
      channelCount: project.channelCount ?? -1, // -1 means unknown, but usually it's set
    };

    // Check for critical failures (failed posts)
    if (counts.failedPosts > 0) {
      problems.push({
        type: 'critical',
        key: 'failedPosts',
        count: counts.failedPosts,
      });
    }

    // Check for problem publications (critical)
    if (counts.problemPublications > 0) {
      problems.push({
        type: 'critical',
        key: 'problemPublications',
        count: counts.problemPublications,
      });
    }

    // Check for stale channels (warnings)
    if (counts.staleChannels > 0) {
      problems.push({
        type: 'warning',
        key: 'staleChannels',
        count: counts.staleChannels,
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
    if (counts.noCredentials > 0) {
      problems.push({
        type: 'critical',
        key: 'noCredentials',
        count: counts.noCredentials,
      });
    }

    // Check for inactive channels (warning)
    if (counts.inactiveChannels > 0) {
      problems.push({
        type: 'warning',
        key: 'inactiveChannels',
        count: counts.inactiveChannels,
      });
    }

    // Check for no channels (critical)
    if (counts.channelCount === 0) {
      problems.push({
        type: 'critical',
        key: 'noChannels',
      });
    }

    return problems;
  }

  function getProjectProblemLevel(project: ProjectWithRole | null): 'critical' | 'warning' | null {
    if (!project) return null;
    const problems = getProjectProblems(project);
    if (problems.some(p => p.type === 'critical')) return 'critical';
    if (problems.some(p => p.type === 'warning')) return 'warning';
    return null;
  }

  function getProjectProblemsSummary(project: ProjectWithRole) {
    const problems = getProjectProblems(project);
    const critical = problems.filter(p => p.type === 'critical');
    const warnings = problems.filter(p => p.type === 'warning');

    return {
      problems,
      errorsCount: critical.reduce((sum, p) => sum + (p.count || 1), 0),
      warningsCount: warnings.reduce((sum, p) => sum + (p.count || 1), 0),
      errorsTooltip: critical
        .map(p => t(`problems.project.${p.key}`, { count: p.count || 1 }))
        .join(', '),
      warningsTooltip: warnings
        .map(p => t(`problems.project.${p.key}`, { count: p.count || 1 }))
        .join(', '),
      level: critical.length > 0 ? 'critical' : warnings.length > 0 ? 'warning' : null,
    };
  }

  async function transferProject(
    projectId: string,
    data: { targetUsername: string; projectName: string; clearCredentials: boolean },
  ): Promise<boolean> {
    const [err] = await executeAction(
      async () => {
        await api.post(`/projects/${projectId}/transfer`, data);
        await fetchProjects();
      },
      { 
        loadingRef: loadingBinding, 
        errorRef: errorBinding,
        successMessage: t('project.transferSuccess', 'Project transferred successfully') 
      }
    );
    return !err;
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
    canTransfer,
    archiveProject,
    unarchiveProject,
    canManageMembers,

    // Problem detection
    getProjectProblems,
    getProjectProblemLevel,
    getProjectProblemsSummary,
  };
}
