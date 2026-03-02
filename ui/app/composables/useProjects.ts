import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useProjectsStore } from '~/stores/projects';
import type { Project, ProjectWithRole, ProjectMemberWithUser } from '~/types/projects';
import { ArchiveEntityType } from '~/types/archive.types';
import { logger } from '~/utils/logger';
import { applyArchiveQueryFlags } from '~/utils/archive-query';
import { PROJECTS_FETCH_LIMIT } from '~/constants';
import {
  canProjectBeEdited,
  canProjectBeDeleted,
  canProjectBeTransferred,
  canManageProjectMembers,
  getProjectProblems,
  getProjectProblemLevel,
  getProjectProblemsSummary,
} from '~/utils/projects';

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

  const projectsController = ref<AbortController | null>(null);
  
  async function fetchProjects(
    arg?:
      | boolean
      | {
          includeArchived?: boolean;
          hasContentCollections?: boolean;
          signal?: AbortSignal;
        },
  ): Promise<ProjectWithRole[]> {
    if (typeof arg !== 'object' || !arg?.signal) {
      projectsController.value?.abort();
      projectsController.value = api.createAbortController();
    }

    const [, result] = await executeAction(
      async () => {
        const options = typeof arg === 'object' ? arg : { includeArchived: arg };
        const params: Record<string, string | number | boolean | undefined> = { limit: PROJECTS_FETCH_LIMIT };
        applyArchiveQueryFlags(params, { includeArchived: options.includeArchived });
        if (options.hasContentCollections) {
          params.hasContentCollections = true;
        }
        const data = await api.get<ProjectWithRole[]>('/projects', { 
          params, 
          signal: options.signal || projectsController.value?.signal 
        });
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

  async function fetchProject(projectId: string, options: { signal?: AbortSignal } = {}): Promise<ProjectWithRole | null> {
    const [, result] = await executeAction(
      async () => {
        const data = await api.get<ProjectWithRole>(`/projects/${projectId}`, { signal: options.signal });
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
    return canProjectBeEdited(project, user.value?.id)
  }

  function canDelete(project: ProjectWithRole): boolean {
    return canProjectBeDeleted(project, user.value?.id)
  }

  function canTransfer(project: ProjectWithRole): boolean {
    return canProjectBeTransferred(project, user.value?.id)
  }

  function canManageMembers(project: ProjectWithRole): boolean {
    return canManageProjectMembers(project, user.value?.id)
  }

  function clearCurrentProject() {
    store.setCurrentProject(null)
    store.setError(null)
  }

  function getProjectProblemsWrapper(project: ProjectWithRole) {
    return getProjectProblems(project)
  }

  function getProjectProblemLevelWrapper(project: ProjectWithRole | null) {
    return getProjectProblemLevel(project)
  }

  function getProjectProblemsSummaryWrapper(project: ProjectWithRole) {
    return getProjectProblemsSummary(project, t)
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
    getProjectProblems: getProjectProblemsWrapper,
    getProjectProblemLevel: getProjectProblemLevelWrapper,
    getProjectProblemsSummary: getProjectProblemsSummaryWrapper,
  };
}
