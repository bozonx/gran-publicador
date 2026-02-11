/**
 * Checks if channel credentials are missing or empty.
 * Returns true if credentials object is missing, null, empty or contains only empty values.
 * If socialMedia is provided, it checks for specific required fields.
 */
export function isChannelCredentialsEmpty(credentials: any, socialMedia?: string): boolean {
  if (!credentials || typeof credentials !== 'object') {
    return true;
  }

  const values = Object.values(credentials);
  if (values.length === 0) {
    return true;
  }

  // Social-media specific checks
  if (socialMedia === 'telegram') {
    const { telegramBotToken, telegramChannelId } = credentials;
    if (
      !telegramBotToken ||
      !telegramChannelId ||
      String(telegramBotToken).trim().length === 0 ||
      String(telegramChannelId).trim().length === 0
    ) {
      return true;
    }
  } else if (socialMedia === 'vk') {
    const { vkAccessToken } = credentials;
    if (!vkAccessToken || String(vkAccessToken).trim().length === 0) {
      return true;
    }
  }

  // Fallback: check if all values are null, undefined or empty strings
  return values.every((v: any) => {
    return v === null || v === undefined || String(v).trim().length === 0;
  });
}

export function getChannelProblems(channel: any) {
  const problems: Array<{ type: 'critical' | 'warning'; key: string; count?: number }> = [];

  // Critical: No credentials
  if (isChannelCredentialsEmpty(channel.credentials, channel.socialMedia)) {
    problems.push({ type: 'critical', key: 'noCredentials' });
  }

  // Critical: Failed posts
  if (channel.failedPostsCount && channel.failedPostsCount > 0) {
    problems.push({
      type: 'critical',
      key: 'failedPosts',
      count: channel.failedPostsCount,
    });
  }

  // Warning: Stale channel
  if (channel.isStale) {
    problems.push({ type: 'warning', key: 'staleChannel' });
  }

  // Warning: Inactive channel
  if (channel.isActive !== undefined && !channel.isActive) {
    problems.push({ type: 'warning', key: 'inactiveChannel' });
  }

  return problems;
}

export function getChannelProblemLevel(channel: any): 'critical' | 'warning' | null {
  if (!channel) return null;
  const problems = getChannelProblems(channel);
  if (problems.some(p => p.type === 'critical')) return 'critical';
  if (problems.some(p => p.type === 'warning')) return 'warning';
  return null;
}
