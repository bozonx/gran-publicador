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

export function getPostUrl(post: any): string | null {
  if (!post || (post.status !== 'PUBLISHED' && post.status !== 'PARTIAL')) {
    return null;
  }

  // Parse meta if it's a string
  let meta = post.meta;
  if (typeof meta === 'string') {
    try {
      meta = JSON.parse(meta);
    } catch {
      meta = {};
    }
  }

  // Check if microservice returned URL in meta.attempts
  if (meta?.attempts && Array.isArray(meta.attempts)) {
    const sortedAttempts = [...meta.attempts].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    const lastSuccess = sortedAttempts.find((attempt) => attempt.success && attempt.response?.url);
    if (lastSuccess) {
      return lastSuccess.response.url;
    }
  }

  // Backup: manual URL construction based on channel identifier and post id
  if (meta?.attempts && Array.isArray(meta.attempts)) {
    const sortedAttempts = [...meta.attempts].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    const lastSuccessAttempt = sortedAttempts.find((a: any) => a.success && a.response);
    
    if (lastSuccessAttempt) {
      const platformPostId = lastSuccessAttempt.response.postId;
      const socialMedia = post.socialMedia || post.channel?.socialMedia;
      const channelId = post.channel?.channelIdentifier;
      
      if (platformPostId && channelId) {
        if (socialMedia === 'telegram') {
          return `https://t.me/${channelId.replace('@', '')}/${platformPostId}`;
        } else if (socialMedia === 'vk') {
          const vkGroupId = channelId.startsWith('-') ? channelId : `-${channelId}`;
          return `https://vk.com/wall${vkGroupId}_${platformPostId}`;
        }
      }
    }
  }

  return null;
}
