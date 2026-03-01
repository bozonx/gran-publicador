import type { PostWithRelations } from '~/types/posts';
import { usePostState } from './usePostState';

export function getPostTitle(post: PostWithRelations): string | null {
  return post.publication?.title ?? null;
}

export function getPostContent(post: PostWithRelations): string {
  return post.content ?? post.publication?.content ?? '';
}

export function getPostTags(post: PostWithRelations): string[] {
  return post.tags ?? post.publication?.tags ?? [];
}

export function getPostDescription(post: PostWithRelations): string | null {
  return post.publication?.description ?? null;
}

export function getPostType(post: PostWithRelations): string {
  return post.publication?.postType ?? 'POST';
}

export function getPostLanguage(post: PostWithRelations): string {
  return post.publication?.language ?? 'en-US';
}

export function getPostScheduledAt(post: PostWithRelations): string | null {
  return post.scheduledAt ?? post.publication?.scheduledAt ?? null;
}

export function usePostUi() {
  const state = usePostState();

  function clearCurrentPost() {
    state.currentPost.value = null;
    state.error.value = null;
  }

  return {
    getPostTitle,
    getPostContent,
    getPostTags,
    getPostDescription,
    getPostType,
    getPostLanguage,
    getPostScheduledAt,
    clearCurrentPost,
  };
}
