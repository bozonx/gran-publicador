export type PostStatus = import('@gran/shared/post-statuses').PostStatus;
export type PublicationStatus = import('@gran/shared/post-statuses').PublicationStatus;
export type PostType = import('@gran/shared/social-media-platforms').PostType;

export interface Post {
  id: string;
  channelId: string;
  publicationId: string;
  socialMedia: string;
  tags: string[] | null; // Can override publication tags
  status: PostStatus; // Post-specific status
  scheduledAt: string | null;
  publishedAt: string | null;
  errorMessage: string | null;
  meta: any;
  content: string | null;
  authorSignature: string | null;
  platformOptions: any;
  postingSnapshot: any; // Frozen snapshot of the post content
  postingSnapshotCreatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PostWithRelations extends Post {
  channel?: {
    id: string;
    name: string;
    projectId: string;
    socialMedia: string;
    language: string;
    isActive?: boolean;
    archivedAt?: string | null;
    project?: { id: string; archivedAt: string | null; name: string };
  } | null;
  publication?: {
    id: string;
    title: string | null;
    description: string | null;
    content: string;
    authorComment: string | null;
    tags: string[]; // Fallback if post.tags is null
    mediaFiles: any;
    meta: any;
    postType: string;
    postDate: string | null;
    status: string; // Publication status
    language: string;
    createdBy: string | null;
    scheduledAt: string | null;
    archivedAt: string | null;
  } | null;
}

export interface PostTemplateData {
  id: string;
}
