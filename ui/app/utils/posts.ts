const POST_STATUS_CONFIG: Record<string, { color: 'neutral' | 'warning' | 'success' | 'error', icon: string }> = {
  PENDING: { color: 'neutral', icon: 'i-heroicons-clock' },
  PUBLISHED: { color: 'success', icon: 'i-heroicons-check-circle' },
  FAILED: { color: 'error', icon: 'i-heroicons-exclamation-circle' },
};

const POST_TYPE_CONFIG: Record<string, { color: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral', icon: string }> = {
  POST: { color: 'primary', icon: 'i-heroicons-chat-bubble-bottom-center-text' },
  ARTICLE: { color: 'success', icon: 'i-heroicons-document-text' },
  NEWS: { color: 'warning', icon: 'i-heroicons-newspaper' },
  VIDEO: { color: 'error', icon: 'i-heroicons-video-camera' },
  SHORT: { color: 'info', icon: 'i-heroicons-bolt' },
  STORY: { color: 'neutral', icon: 'i-heroicons-camera' },
};

export function getPostStatusColor(
  status: string | undefined | null,
): 'neutral' | 'warning' | 'success' | 'error' {
  if (!status) return 'neutral';
  return POST_STATUS_CONFIG[status.toUpperCase()]?.color || 'neutral';
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
  return POST_TYPE_CONFIG[type.toUpperCase()]?.icon || 'i-heroicons-plus';
}

export function getPostTypeColor(
  type: string | undefined | null,
): 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral' {
  if (!type) return 'primary';
  return POST_TYPE_CONFIG[type.toUpperCase()]?.color || 'primary';
}

export function getPostStatusIcon(status: string | undefined | null): string {
  if (!status) return 'i-heroicons-question-mark-circle';
  return POST_STATUS_CONFIG[status.toUpperCase()]?.icon || 'i-heroicons-question-mark-circle';
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
        if (socialMedia?.toUpperCase() === 'TELEGRAM') {
          return `https://t.me/${channelId.replace('@', '')}/${platformPostId}`;
        } else if (socialMedia?.toUpperCase() === 'VK') {
          const vkGroupId = channelId.startsWith('-') ? channelId : `-${channelId}`;
          return `https://vk.com/wall${vkGroupId}_${platformPostId}`;
        }
      }
    }
  }

  return null;
}
