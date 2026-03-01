import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';
import type { ProjectWithRole, ProjectMemberWithUser } from '~/types/projects';

/**
 * Projects store using Dumb Store pattern.
 */
export const useProjectsStore = defineStore('projects', () => {
  const projects = shallowRef<ProjectWithRole[]>([]);
  const currentProject = ref<ProjectWithRole | null>(null);
  const members = ref<ProjectMemberWithUser[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  function setProjects(newProjects: ProjectWithRole[]) {
    projects.value = newProjects;
  }

  function setCurrentProject(project: ProjectWithRole | null) {
    currentProject.value = project;
  }

  function setMembers(newMembers: ProjectMemberWithUser[]) {
    members.value = newMembers;
  }

  function setLoading(loading: boolean) {
    isLoading.value = loading;
  }

  function setError(err: string | null) {
    error.value = err;
  }

  function addProject(project: ProjectWithRole) {
    projects.value = [project, ...projects.value];
  }

  function updateProject(projectId: string, data: Partial<ProjectWithRole>) {
    const pList = [...projects.value];
    const index = pList.findIndex(b => b.id === projectId);
    if (index !== -1) {
      pList[index] = { ...pList[index], ...data } as ProjectWithRole;
      projects.value = pList;
    }
    if (currentProject.value?.id === projectId) {
      currentProject.value = { ...currentProject.value, ...data } as ProjectWithRole;
    }
  }

  function removeProject(projectId: string) {
    projects.value = projects.value.filter(b => b.id !== projectId);
    if (currentProject.value?.id === projectId) {
      currentProject.value = null;
    }
  }

  function reset() {
    projects.value = [];
    currentProject.value = null;
    members.value = [];
    isLoading.value = false;
    error.value = null;
  }

  return {
    projects,
    currentProject,
    members,
    isLoading,
    error,
    setProjects,
    setCurrentProject,
    setMembers,
    setLoading,
    setError,
    addProject,
    updateProject,
    removeProject,
    reset,
  };
});
