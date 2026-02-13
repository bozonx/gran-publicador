export interface TagSearchScope {
  projectId?: string;
  userId?: string;
}

export interface ResolvedTagSearchScope {
  scope: TagSearchScope | null;
  reason: 'ok' | 'missing' | 'conflict';
}

export function resolveTagSearchScope(input: TagSearchScope): ResolvedTagSearchScope {
  const hasProjectId = Boolean(input.projectId);
  const hasUserId = Boolean(input.userId);

  if (!hasProjectId && !hasUserId) {
    return {
      scope: null,
      reason: 'missing',
    };
  }

  if (hasProjectId && hasUserId) {
    return {
      scope: null,
      reason: 'conflict',
    };
  }

  if (hasProjectId) {
    return {
      scope: {
        projectId: input.projectId,
      },
      reason: 'ok',
    };
  }

  return {
    scope: {
      userId: input.userId,
    },
    reason: 'ok',
  };
}

export interface PrependCaseInsensitiveUniqueTagsInput {
  currentItems: string[];
  candidateTags: string[];
}

export function prependCaseInsensitiveUniqueTags(
  input: PrependCaseInsensitiveUniqueTagsInput,
): string[] {
  const seen = new Set(
    (input.currentItems ?? [])
      .map(tag => String(tag ?? '').trim())
      .filter(Boolean)
      .map(tag => tag.toLowerCase()),
  );

  const prepended: string[] = [];

  for (const rawTag of input.candidateTags ?? []) {
    const tag = String(rawTag ?? '').trim();
    if (!tag) continue;

    const key = tag.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    prepended.push(tag);
  }

  if (prepended.length === 0) {
    return input.currentItems;
  }

  return [...prepended, ...input.currentItems];
}

export interface SearchRequestTracker {
  next: () => number;
  isLatest: (requestId: number) => boolean;
  invalidate: () => void;
}

export function createSearchRequestTracker(): SearchRequestTracker {
  let currentRequestId = 0;

  return {
    next() {
      currentRequestId += 1;
      return currentRequestId;
    },
    isLatest(requestId: number) {
      return requestId === currentRequestId;
    },
    invalidate() {
      currentRequestId += 1;
    },
  };
}
