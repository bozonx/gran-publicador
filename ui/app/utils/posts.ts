export const POST_STATUS_COLORS: Record<string, 'neutral' | 'warning' | 'success' | 'error'> = {
  pending: 'neutral',
  published: 'success',
  failed: 'error',
};

export function getPostStatusColor(
  status: string | undefined | null,
): 'neutral' | 'warning' | 'success' | 'error' {
  if (!status) return 'neutral';
  return POST_STATUS_COLORS[status.toLowerCase()] || 'neutral';
}

export function getPostStatusOptions(t: (key: string) => string) {
  return [
    { value: 'PENDING', label: t('postStatus.pending') },
    { value: 'PUBLISHED', label: t('postStatus.published') },
    { value: 'FAILED', label: t('postStatus.failed') },
  ];
}

export function getPostTypeOptions(t: (key: string) => string) {
  return [
    { value: 'POST', label: t('postType.post') },
    { value: 'ARTICLE', label: t('postType.article') },
    { value: 'NEWS', label: t('postType.news') },
    { value: 'VIDEO', label: t('postType.video') },
    { value: 'SHORT', label: t('postType.short') },
    { value: 'STORY', label: t('postType.story') },
  ];
}

export function getPostStatusDisplayName(
  status: string | undefined | null,
  t: (key: string) => string,
): string {
  if (!status) return '-';
  return t(`postStatus.${status.toLowerCase()}`);
}

export function getPostTypeDisplayName(
  type: string | undefined | null,
  t: (key: string) => string,
): string {
  if (!type) return '-';
  return t(`postType.${type.toLowerCase()}`);
}

export function getPostTypeIcon(type: string | undefined | null): string {
  if (!type) return 'i-heroicons-plus';
  switch (type.toUpperCase()) {
    case 'POST':
      return 'i-heroicons-chat-bubble-bottom-center-text';
    case 'ARTICLE':
      return 'i-heroicons-document-text';
    case 'NEWS':
      return 'i-heroicons-newspaper';
    case 'VIDEO':
      return 'i-heroicons-video-camera';
    case 'SHORT':
      return 'i-heroicons-bolt';
    case 'STORY':
      return 'i-heroicons-camera';
    default:
      return 'i-heroicons-plus';
  }
}

export function getPostTypeColor(
  type: string | undefined | null,
): 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral' {
  if (!type) return 'primary';
  switch (type.toUpperCase()) {
    case 'POST':
      return 'primary';
    case 'ARTICLE':
      return 'success';
    case 'NEWS':
      return 'warning';
    case 'VIDEO':
      return 'error';
    case 'SHORT':
      return 'info';
    case 'STORY':
      return 'neutral';
    default:
      return 'primary';
  }
}

export function getPostStatusIcon(status: string | undefined | null): string {
  if (!status) return 'i-heroicons-question-mark-circle';
  switch (status.toUpperCase()) {
    case 'PENDING':
      return 'i-heroicons-clock';
    case 'PUBLISHED':
      return 'i-heroicons-check-circle';
    case 'FAILED':
      return 'i-heroicons-exclamation-circle';
    default:
      return 'i-heroicons-question-mark-circle';
  }
}
