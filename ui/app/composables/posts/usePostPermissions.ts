import type { PostWithRelations } from '~/types/posts';
import { useAuth } from '#imports';

export function usePostPermissions() {
  const { user } = useAuth();

  function canDeletePost(post: PostWithRelations): boolean {
    if (!user.value) return false;
    // Keep original logic: if user is author of publication
    return post.publication?.createdBy === user.value.id;
  }

  function canEditPost(post: PostWithRelations): boolean {
    return canDeletePost(post);
  }

  return {
    canDeletePost,
    canEditPost,
  };
}
