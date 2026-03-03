import { describe, expect, it, vi, beforeEach } from 'vitest';
import { usePublicationValidator } from '../../app/composables/usePublicationValidator';

// Mock social media validation
const mockValidatePostContent = vi.fn();
vi.mock('~/composables/useSocialMediaValidation', () => ({
  useSocialMediaValidation: () => ({
    validatePostContent: mockValidatePostContent,
  }),
}));

describe('usePublicationValidator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateForChannels', () => {
    it('returns empty errors when no channels selected', () => {
      const { validateForChannels } = usePublicationValidator();
      const errors = validateForChannels('content', 0, [], 'text', [], []);
      expect(errors).toEqual([]);
      expect(mockValidatePostContent).not.toHaveBeenCalled();
    });

    it('calls validatePostContent for each selected channel', () => {
      mockValidatePostContent.mockReturnValue({ isValid: true, errors: [] });
      const { validateForChannels } = usePublicationValidator();
      
      const channels = [
        { id: '1', name: 'TG', socialMedia: 'telegram' },
        { id: '2', name: 'INSTA', socialMedia: 'instagram' },
      ] as any;
      
      validateForChannels('content', 1, [{ type: 'image' }], 'image', ['1', '2'], channels);
      
      expect(mockValidatePostContent).toHaveBeenCalledTimes(2);
      expect(mockValidatePostContent).toHaveBeenCalledWith('content', 1, 'telegram', [{ type: 'image' }], 'image', undefined);
      expect(mockValidatePostContent).toHaveBeenCalledWith('content', 1, 'instagram', [{ type: 'image' }], 'image', undefined);
    });

    it('collects and formats errors from validation results', () => {
      mockValidatePostContent.mockReturnValueOnce({ 
        isValid: false, 
        errors: [{ message: 'Too long' }] 
      }).mockReturnValueOnce({
        isValid: true,
        errors: []
      });
      
      const { validateForChannels } = usePublicationValidator();
      const channels = [
        { id: '1', name: 'TG', socialMedia: 'telegram' },
        { id: '2', name: 'INSTA', socialMedia: 'instagram' },
      ] as any;
      
      const errors = validateForChannels('content', 0, [], 'text', ['1', '2'], channels);
      
      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual({
        channel: 'TG',
        message: 'Too long'
      });
    });
  });

  describe('validateForExistingPosts', () => {
    it('returns empty errors when publication has no posts', () => {
      const { validateForExistingPosts } = usePublicationValidator();
      const errors = validateForExistingPosts('content', 0, [], 'text', { id: '1', posts: [] } as any);
      expect(errors).toEqual([]);
    });

    it('validates only posts that inherit content', () => {
      mockValidatePostContent.mockReturnValue({ isValid: true, errors: [] });
      const { validateForExistingPosts } = usePublicationValidator();
      
      const publication = {
        id: '1',
        posts: [
          { id: 'p1', content: null, channel: { name: 'TG', socialMedia: 'telegram' } }, // Inherits
          { id: 'p2', content: 'Custom content', channel: { name: 'INSTA', socialMedia: 'instagram' } }, // Does not inherit
        ]
      } as any;
      
      validateForExistingPosts('parent content', 0, [], 'text', publication);
      
      expect(mockValidatePostContent).toHaveBeenCalledTimes(1);
      expect(mockValidatePostContent).toHaveBeenCalledWith('parent content', 0, 'telegram', [], 'text', []);
    });
  });
});
