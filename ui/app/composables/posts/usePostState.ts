import { storeToRefs } from 'pinia';
import { usePostsStore } from '~/stores/posts';
import type { PostStatus, PostType, PublicationStatus } from '~/types/posts';

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
  const store = usePostsStore();
  const { 
    items: posts, 
    currentPost, 
    isLoading, 
    error, 
    totalCount, 
    filter, 
    pagination 
  } = storeToRefs(store);

  return {
    posts,
    currentPost,
    isLoading,
    error,
    totalCount,
    filter,
    pagination,
    // Add store reference for setters
    store
  };
}
