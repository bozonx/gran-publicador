import type { Role } from '~/types/roles.types';
import type { Channel } from '~/types/channels';

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
  channels?: Channel[];
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
