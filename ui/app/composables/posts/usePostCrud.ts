import { useApi, useApiAction, useI18n, useToast } from '#imports';
import { usePostState, type PostsFilter } from './usePostState';
import { applyArchiveQueryFlags } from '~/utils/archive-query';
import type { Post, PostWithRelations, PostStatus } from '~/types/posts';
import { logger } from '~/utils/logger';

export interface PostCreateInput {
  channelId: string;
  publicationId: string;
  tags?: string[] | null;
  status?: PostStatus | null;
  scheduledAt?: string | null;
  content?: string | null;
  meta?: any;
  authorSignature?: string | null;
  platformOptions?: any;
}

export interface PostUpdateInput {
  tags?: string[] | null;
  status?: PostStatus;
  scheduledAt?: string | null;
  publishedAt?: string | null;
  content?: string | null;
  meta?: any;
  authorSignature?: string | null;
  platformOptions?: any;
}

export function usePostCrud() {
  const api = useApi();
  const { executeAction } = useApiAction();
  const { t } = useI18n();
  const state = usePostState();

  async function fetchPosts(
    filters: Partial<PostsFilter> = {},
    options: { append?: boolean; projectId?: string } = {},
  ): Promise<PostWithRelations[]> {
    const [, result] = await executeAction(
      async () => {
        const mergedFilters = { ...state.filter.value, ...filters };
        const params: Record<string, string | number | boolean | string[] | undefined> = { ...mergedFilters } as any;
        
        if (options.projectId && !mergedFilters.channelId) {
          params.projectId = options.projectId;
        }

        const limit = mergedFilters.limit ?? state.pagination.value.limit;
        const offset = typeof mergedFilters.offset === 'number'
          ? mergedFilters.offset
          : (state.pagination.value.page - 1) * limit;
        
        params.limit = limit;
        params.offset = Math.max(0, offset);
        
        applyArchiveQueryFlags(params, {
          includeArchived: mergedFilters.includeArchived,
        });

        const response = await api.get<{ items: PostWithRelations[]; meta: { total: number } }>(
          '/posts',
          { params },
        );

        if (options.append) {
          state.posts.value = [...state.posts.value, ...response.items];
        } else {
          state.posts.value = response.items;
        }

        state.totalCount.value = response.meta.total;
        return response.items;
      },
      { loadingRef: state.isLoading, errorRef: state.error, silentErrors: true }
    );

    return result || [];
  }

  async function fetchPostsByProject(
    projectId: string,
    options: Partial<PostsFilter> & { append?: boolean } = {},
  ) {
    const { append, ...filters } = options;
    return fetchPosts(filters, { append, projectId });
  }

  async function fetchUserPosts(
    options: Partial<PostsFilter> & { append?: boolean } = {},
  ) {
    const { append, ...filters } = options;
    return fetchPosts(filters, { append });
  }

  async function fetchPost(postId: string): Promise<PostWithRelations | null> {
    const [, result] = await executeAction(
      async () => {
        const data = await api.get<PostWithRelations>(`/posts/${postId}`);
        state.currentPost.value = data;
        return data;
      },
      { loadingRef: state.isLoading, errorRef: state.error, silentErrors: true }
    );
    return result;
  }

  async function createPost(
    data: PostCreateInput,
    options?: { silent?: boolean },
  ): Promise<Post | null> {
    const [, result] = await executeAction(
      async () => {
        return await api.post<Post>('/posts', data);
      },
      { 
        loadingRef: state.isLoading, 
        errorRef: state.error, 
        successMessage: !options?.silent ? t('post.createSuccess') : undefined,
      }
    );
    return result;
  }

  async function updatePost(
    postId: string,
    data: PostUpdateInput,
    options?: { silent?: boolean },
  ): Promise<Post | null> {
    const [, result] = await executeAction(
      async () => {
        const post = await api.patch<Post>(`/posts/${postId}`, data);
        // Update in list if exists
        const index = state.posts.value.findIndex(p => p.id === postId);
        if (index !== -1) {
          state.posts.value[index] = { ...state.posts.value[index], ...post };
        }
        if (state.currentPost.value?.id === postId) {
          state.currentPost.value = { ...state.currentPost.value, ...post };
        }
        return post;
      },
      { 
        loadingRef: state.isLoading, 
        errorRef: state.error, 
        successMessage: !options?.silent ? t('post.updateSuccess') : undefined,
      }
    );
    return result;
  }

  async function deletePost(postId: string): Promise<boolean> {
    const [err] = await executeAction(
      async () => {
        await api.delete(`/posts/${postId}`);
        state.posts.value = state.posts.value.filter(p => p.id !== postId);
        if (state.currentPost.value?.id === postId) {
          state.currentPost.value = null;
        }
      },
      { loadingRef: state.isLoading, errorRef: state.error, successMessage: t('post.deleteSuccess') }
    );
    return !err;
  }

  return {
    fetchPostsByProject,
    fetchUserPosts,
    fetchPost,
    createPost,
    updatePost,
    deletePost,
  };
}
