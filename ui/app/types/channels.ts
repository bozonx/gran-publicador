import type { SocialMedia } from '@gran/shared/social-media-platforms';

export interface TemplateBlock {
  enabled: boolean;
  before?: string;
  insert: 'title' | 'content' | 'tags' | 'authorComment' | 'authorSignature' | 'footer' | 'custom';
  after?: string;
  tagCase?:
    | 'camelCase'
    | 'pascalCase'
    | 'snake_case'
    | 'SNAKE_CASE'
    | 'kebab-case'
    | 'KEBAB-CASE'
    | 'lower_case'
    | 'upper_case'
    | 'none';
  content?: string;
}

export interface BlockOverride {
  enabled?: boolean;
  before?: string;
  after?: string;
  content?: string;
  tagCase?: string;
}

export interface ChannelTemplateVariation {
  projectTemplateId: string;
  excluded?: boolean;
  overrides?: Record<string, BlockOverride>;
}

export interface ProjectTemplate {
  id: string;
  projectId: string;
  name: string;
  postType?: string | null;
  language: string | null;
  order: number;
  template: TemplateBlock[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectTemplateUpdateInput {
  name?: string;
  postType?: string | null;
  language?: string | null;
  template?: TemplateBlock[];
  version?: number;
}

export interface Channel {
  id: string;
  projectId: string;
  socialMedia: SocialMedia;
  name: string;
  note?: string | null;
  channelIdentifier: string;
  language: string;
  preferences?: {
    staleChannelsDays?: number;
    templates?: ChannelTemplateVariation[];
  };
  coordinates?: string;
  credentials?: Record<string, any>;
  isActive: boolean;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  tags?: string | null;
  version?: number;
}

export interface ChannelWithProject extends Channel {
  project?: {
    id: string;
    name: string;
    archivedAt?: string | null;
    ownerId?: string;
  } | null;
  role?: string;
  isStale?: boolean;
  postsCount?: number;
  failedPostsCount?: number;
  lastPostAt?: string;
  lastPostId?: string | null;
  lastPublicationId?: string | null;
  hasCredentials?: boolean;
  problems?: Array<{ type: 'critical' | 'warning'; key: string; count?: number }>;
}

export interface ChannelCreateInput {
  projectId: string;
  name: string;
  note?: string | null;
  socialMedia: SocialMedia;
  channelIdentifier: string;
  language: string;
  isActive?: boolean;
  credentials?: Record<string, any>;
  preferences?: {
    staleChannelsDays?: number;
    templates?: ChannelTemplateVariation[];
  };
  tags?: string | null;
}

export interface ChannelUpdateInput {
  name?: string;
  note?: string | null;
  channelIdentifier?: string;
  credentials?: Record<string, any>;
  preferences?: {
    staleChannelsDays?: number;
    templates?: ChannelTemplateVariation[];
  };
  isActive?: boolean;
  tags?: string | null;
  version?: number;
}

export interface ChannelsFilter {
  projectId?: string;
  socialMedia?: SocialMedia | null;
  isActive?: boolean | null;
  search?: string;
  includeArchived?: boolean;
}
