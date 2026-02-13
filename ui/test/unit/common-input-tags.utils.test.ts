import { describe, expect, it } from 'vitest';

import {
  createSearchRequestTracker,
  prependCaseInsensitiveUniqueTags,
  resolveTagSearchScope,
} from '../../app/utils/common-input-tags';

describe('utils/common-input-tags', () => {
  describe('resolveTagSearchScope', () => {
    it('returns missing when no scope is provided', () => {
      expect(resolveTagSearchScope({})).toEqual({
        scope: null,
        reason: 'missing',
      });
    });

    it('returns conflict when both projectId and userId are provided', () => {
      expect(
        resolveTagSearchScope({
          projectId: 'project-id',
          userId: 'user-id',
        }),
      ).toEqual({
        scope: null,
        reason: 'conflict',
      });
    });

    it('returns project scope when only projectId is provided', () => {
      expect(resolveTagSearchScope({ projectId: 'project-id' })).toEqual({
        scope: { projectId: 'project-id' },
        reason: 'ok',
      });
    });

    it('returns user scope when only userId is provided', () => {
      expect(resolveTagSearchScope({ userId: 'user-id' })).toEqual({
        scope: { userId: 'user-id' },
        reason: 'ok',
      });
    });
  });

  describe('prependCaseInsensitiveUniqueTags', () => {
    it('prepends only unique tags in case-insensitive mode', () => {
      const result = prependCaseInsensitiveUniqueTags({
        currentItems: ['Tag', 'News'],
        candidateTags: ['tag', 'release', 'NEWS', 'Update'],
      });

      expect(result).toEqual(['release', 'Update', 'Tag', 'News']);
    });

    it('returns currentItems as-is when no candidate tag is unique', () => {
      const currentItems = ['Alpha', 'Beta'];

      const result = prependCaseInsensitiveUniqueTags({
        currentItems,
        candidateTags: ['alpha', 'beta', '  '],
      });

      expect(result).toBe(currentItems);
    });
  });

  describe('createSearchRequestTracker', () => {
    it('marks only the latest request id as active', () => {
      const tracker = createSearchRequestTracker();

      const first = tracker.next();
      const second = tracker.next();

      expect(tracker.isLatest(first)).toBe(false);
      expect(tracker.isLatest(second)).toBe(true);

      tracker.invalidate();

      expect(tracker.isLatest(second)).toBe(false);
    });
  });
});
