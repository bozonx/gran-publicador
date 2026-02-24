import type { PublicationStatus } from './posts'

export interface Publication {
  id: string;
  projectId: string;
  createdBy: string | null;
  title: string | null;
  description: string | null;
  content: string | null;
  tags: string[];
  status: PublicationStatus;
  meta: string;
  language: string;
  postType: string;
  newsItemId?: string | null;
  postDate: string | null;
  createdAt: string;
  updatedAt?: string | null;
  archivedBy: string | null;
  authorComment: string | null;
  note: string | null;
  archivedAt?: string | null;
  scheduledAt?: string | null;
  postScheduledAt?: string | null;
  authorSignatureId?: string | null;
  projectTemplateId?: string | null;
  version?: number;
}

export interface PublicationWithRelations extends Publication {
  tagObjects?: Array<{ id: string; name: string; normalizedName?: string }>;
  creator?: {
    id: string;
    fullName: string | null;
    telegramUsername: string | null;
    avatarUrl: string | null;
  } | null;
  project?: {
    id: string;
    name: string;
  } | null;
  posts?: any[];
  relations?: Array<{
    id: string;
    type: string;
    projectId: string;
    items: Array<{
      id: string;
      position: number;
      publication: {
        id: string;
        title: string | null;
        language: string;
        postType: string;
        status: string;
        archivedAt: string | null;
        posts?: Array<{
          id: string;
          status: string;
          postingSnapshot?: any;
          postingSnapshotCreatedAt?: string | null;
          channel: {
            id: string;
            name: string;
            socialMedia: string;
            isActive: boolean;
            archivedAt: string | null;
            project: { id: string; archivedAt: string | null };
          };
        }>;
      };
    }>;
  }>;
  media?: Array<{
    id: string;
    order: number;
    media?: {
      id: string;
      type: string;
      storageType: string;
      storagePath: string;
      filename?: string;
      mimeType?: string;
      sizeBytes?: number;
      meta?: Record<string, any>;
    };
  }>;
  contentItems?: Array<{
    id: string;
    order: number;
    contentItem: {
      id: string;
      title: string | null;
      tags: string[];
    };
  }>;
  _count?: {
    posts: number;
  };
}

export interface PublicationsFilter {
  status?: PublicationStatus | PublicationStatus[] | null;
  channelId?: string | null;
  projectId?: string | null;
  limit?: number;
  offset?: number;
  includeArchived?: boolean;
  archivedOnly?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  language?: string;
  ownership?: 'own' | 'notOwn' | 'all';
  issueType?: 'failed' | 'partial' | 'expired' | 'problematic' | 'all';
  socialMedia?: string;
  scope?: 'projects';
  publishedAfter?: string;
  tags?: string | null;
}

export interface PaginatedPublications {
  items: PublicationWithRelations[];
  meta: {
    total: number;
    totalUnfiltered?: number;
    limit: number;
    offset: number;
  };
}

export interface PublicationLlmChatContextInput {
  content?: string;
  mediaDescriptions?: string[];
  contextLimitChars?: number;
}

export interface PublicationLlmChatInput {
  message: string;
  context?: PublicationLlmChatContextInput;
  temperature?: number;
  max_tokens?: number;
  model?: string;
  tags?: string[];
  onlyRawResult?: boolean;
}

export interface PublicationLlmChatResponse {
  message: string;
  metadata?: any;
  usage?: any;
  chat?: {
    messages: Array<{ role: string; content: string }>;
    context?: PublicationLlmChatContextInput;
    savedAt?: string;
    model?: any;
    usage?: any;
  };
}

export interface PublicationProblem {
  type: 'critical' | 'warning';
  key: string;
  count?: number;
}
