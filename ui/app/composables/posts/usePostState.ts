import { useState } from '#imports';
import type { PostWithRelations, PostStatus, PostType, PublicationStatus } from '~/types/posts';

export interface PostsFilter {
  status?: PostStatus | null;
  postType?: PostType | null;
  createdBy?: string | null;
  channelId?: string | null;
  search?: string;
  limit?: number;
  offset?: number;
  includeArchived?: boolean;
  publicationStatus?: PublicationStatus | PublicationStatus[] | null;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function usePostState() {
  const posts = useState<PostWithRelations[]>('usePosts.posts', () => []);
  const currentPost = useState<PostWithRelations | null>('usePosts.currentPost', () => null);
  const isLoading = useState<boolean>('usePosts.isLoading', () => false);
  const error = useState<string | null>('usePosts.error', () => null);
  const totalCount = useState<number>('usePosts.totalCount', () => 0);
  const filter = useState<PostsFilter>('usePosts.filter', () => ({}));
  const pagination = useState<{ page: number; limit: number }>('usePosts.pagination', () => ({
    page: 1,
    limit: 10,
  }));

  return {
    posts,
    currentPost,
    isLoading,
    error,
    totalCount,
    filter,
    pagination,
  };
}
