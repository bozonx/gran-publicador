import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePublicationValidation } from '~/composables/publications/usePublicationValidation';
import { usePublicationState } from '~/composables/publications/usePublicationState';

// Since we are running in the Nuxt environment (test/nuxt), Vue/Nuxt auto-imports such as `computed`, `ref`, `useState`, `useI18n` should work or can be mocked.
// Let's mock `getPublicationProblems` and `useSocialMediaValidation` to test the logic exactly.

vi.mock('~/utils/publications', () => ({
  getPublicationProblems: vi.fn(() => []),
}));

const mockValidatePostContent = vi.fn().mockReturnValue({ isValid: true });

vi.mock('~/composables/useSocialMediaValidation', () => ({
  useSocialMediaValidation: vi.fn(() => ({
    validatePostContent: mockValidatePostContent,
  })),
}));

describe('usePublicationValidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidatePostContent.mockReturnValue({ isValid: true });
    
    // Reset state before tests
    const { currentPublication } = usePublicationState();
    currentPublication.value = null;
  });

  it('currentPublicationPlatforms works correctly', async () => {
    const { currentPublicationPlatforms } = usePublicationValidation();
    const { currentPublication } = usePublicationState();
    
    currentPublication.value = {
      posts: [
        { channel: { socialMedia: 'TELEGRAM' } },
        { channel: { socialMedia: 'VK' } },
        { channel: { socialMedia: 'TELEGRAM' } }, // Duplicate to test unique
        { channel: null }, // Null channel
      ]
    } as any;

    expect(currentPublicationPlatforms.value).toEqual(['TELEGRAM', 'VK']);
  });

  it('currentPublicationProblems without media delegates to getPublicationProblems', async () => {
    const { getEnhancedPublicationProblems } = usePublicationValidation();
    
    const mockProblems = [{ type: 'warning', key: 'someWarning' }];
    const utils = await import('~/utils/publications');
    // We already mocked this at the top with vi.mock
    vi.mocked(utils.getPublicationProblems).mockReturnValueOnce(mockProblems as any);
    
    const pub = {
      posts: [],
      media: [],
    } as any;

    const problems = getEnhancedPublicationProblems(pub);
    expect(problems).toEqual(mockProblems);
  });

  it('currentPublicationProblems adds critical error if media validation fails', async () => {
    const utils = await import('~/utils/publications');
    vi.mocked(utils.getPublicationProblems).mockReturnValueOnce([]);
    mockValidatePostContent.mockReturnValueOnce({ isValid: false });

    const { getEnhancedPublicationProblems } = usePublicationValidation();
    
    const pub = {
      postType: 'POST',
      posts: [
        { channel: { socialMedia: 'TELEGRAM' } },
      ],
      media: [
        { media: { type: 'IMAGE' } }
      ],
    } as any;

    const problems = getEnhancedPublicationProblems(pub);
    
    expect(mockValidatePostContent).toHaveBeenCalledWith('', 1, 'TELEGRAM', [{ type: 'IMAGE' }], 'POST');
    expect(problems).toContainEqual({ type: 'critical', key: 'mediaValidation' });
  });

  it('currentPublicationProblems respects the state reactive variable', () => {
    const { currentPublicationProblems } = usePublicationValidation();
    const { currentPublication } = usePublicationState();
    
    expect(currentPublicationProblems.value).toEqual([]);
    
    currentPublication.value = { id: '1' } as any;
    
    // getEnhancedPublicationProblems will be called, returns empty.
    expect(currentPublicationProblems.value).toEqual([]);
  });
});
