import { computed } from 'vue';
import { useI18n } from '#imports';
import { usePostState } from './posts/usePostState';
import { usePostCrud } from './posts/usePostCrud';
import { usePostFilters } from './posts/usePostFilters';
import { usePostUi } from './posts/usePostUi';
import { usePostPermissions } from './posts/usePostPermissions';
import {
  getPostStatusOptions,
  getPostStatusDisplayName,
  getPostStatusColor,
  getPostStatusIcon,
  getPostTypeDisplayName,
} from '~/utils/posts';

export type { Post, PostWithRelations } from '~/types/posts';
export type { PostCreateInput, PostUpdateInput } from './posts/usePostCrud';
export type { PostsFilter } from './posts/usePostState';

export function usePosts() {
  const { t } = useI18n();
  const state = usePostState();
  const crud = usePostCrud();
  const filters = usePostFilters();
  const ui = usePostUi();
  const perms = usePostPermissions();

  // Backward compatibility: map methods to original names
  return {
    ...state,
    ...crud,
    ...filters,
    ...ui,
    // Original names for status/type functions
    getStatusDisplayName: (status: string) => getPostStatusDisplayName(status, t),
    getTypeDisplayName: (type: string) => getPostTypeDisplayName(type, t),
    getStatusColor: getPostStatusColor,
    getStatusIcon: getPostStatusIcon,
    // Original names for permission functions
    canDelete: perms.canDeletePost,
    canEdit: perms.canEditPost,
    // Computed props
    statusOptions: computed(() => getPostStatusOptions(t)),
    typeOptions: computed(() => [] as Array<{ value: string; label: string }>),
    totalPages: computed(() => Math.ceil(state.totalCount.value / state.pagination.value.limit)),
  };
}

// Re-export utility functions as in original
export { 
  getPostTitle, 
  getPostContent, 
  getPostTags, 
  getPostDescription, 
  getPostType, 
  getPostLanguage, 
  getPostScheduledAt 
} from './posts/usePostUi';
