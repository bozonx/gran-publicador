import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Role } from '~/types/roles.types';

export interface Project {
  id: string;
  name: string;
  note: string | null;
  ownerId: string;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  preferences?: {
    staleChannelsDays?: number;
    mediaOptimization?: MediaOptimizationPreferences;
    [key: string]: any;
  };
  version?: number;
}

export interface ProjectUpdateInput {
  name?: string;
  note?: string | null;
  preferences?: {
    mediaOptimization?: MediaOptimizationPreferences;
    [key: string]: any;
  };
  version?: number;
}

export interface MediaOptimizationPreferences {
  stripMetadata: boolean;
  autoOrient: boolean;
  flatten: string;
  lossless: boolean;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: Role;
  createdAt: string;
}

export interface ProjectWithOwner extends Project {
  owner?: {
    id: string;
    fullName: string | null;
    telegramUsername: string | null;
  } | null;
}

export interface ProjectWithRole extends ProjectWithOwner {
  role?: string;
  memberCount?: number;
  channelCount?: number;
  channels?: any[]; // For components that expect embedded channels
  publicationsCount?: number;
  failedPostsCount?: number;
  staleChannelsCount?: number;
  problemPublicationsCount?: number;
  noCredentialsChannelsCount?: number;
  inactiveChannelsCount?: number;
  lastPublicationAt?: string | null;
  lastPublicationId?: string | null;
  languages?: string[];
  publicationsSummary?: {
    DRAFT: number;
    READY: number;
    SCHEDULED: number;
    PUBLISHED: number;
    ISSUES: number;
  };
}

export interface ProjectMemberWithUser extends ProjectMember {
  user: {
    id: string;
    fullName: string | null;
    telegramUsername: string | null;
    email: string | null;
    avatarUrl: string | null;
  };
}

export const useProjectsStore = defineStore('projects', () => {
  const projects = ref<ProjectWithRole[]>([]);
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
    const index = projects.value.findIndex(b => b.id === projectId);
    if (index !== -1) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      projects.value[index] = { ...projects.value[index], ...(data as any) };
    }
    if (currentProject.value?.id === projectId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      currentProject.value = { ...currentProject.value, ...(data as any) };
    }
  }

  function removeProject(projectId: string) {
    projects.value = projects.value.filter(b => b.id !== projectId);
    if (currentProject.value?.id === projectId) {
      currentProject.value = null;
    }
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
  };
});
