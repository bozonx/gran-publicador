export interface ApiTokenResponse {
  id: string;
  userId: string;
  name: string;
  plainToken: string;
  allProjects: boolean;
  projectIds: string[];
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateApiTokenRequest {
  name: string;
  allProjects?: boolean;
  projectIds?: string[];
}

export interface UpdateApiTokenRequest {
  name?: string;
  allProjects?: boolean;
  projectIds?: string[];
}
