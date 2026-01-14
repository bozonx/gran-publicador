import { SocialPostingBodyFormatter } from '../../src/modules/social-posting/utils/social-posting-body.formatter.js';

describe('SocialPostingBodyFormatter', () => {
  const mockChannel = {
    language: 'en-US',
    preferences: {
      footers: [
        { id: 'f1', name: 'Footer 1', content: 'Footer 1 Content', isDefault: false },
        { id: 'f2', name: 'Default Footer', content: 'Default Footer Content', isDefault: true },
        // @ts-ignore
        { id: 'f3', name: 'Empty Footer', content: '', isDefault: false },
      ],
      templates: [
        {
          id: 't1',
          name: 'Template 1',
          order: 0,
          postType: null,
          language: null,
          template: [
            { enabled: true, insert: 'content', before: '', after: '' },
            { enabled: true, insert: 'footer', before: '', after: '', footerId: 'f1' },
          ],
        },
        {
          id: 't2',
          name: 'Template 2',
          order: 0,
          postType: null,
          language: null,
          template: [
            { enabled: true, insert: 'content', before: '', after: '' },
            { enabled: true, insert: 'footer', before: '', after: '', footerId: null }, // Should use default
          ],
        },
        {
          id: 't3',
          name: 'Template 3',
          order: 0,
          postType: null,
          language: null,
          template: [
            { enabled: true, insert: 'content', before: '', after: '' },
            { enabled: true, insert: 'footer', before: '', after: '', footerId: 'non-existent' }, // Should handle gracefully
          ],
        },
        {
          id: 't4',
          name: 'Template 4',
          order: 0,
          postType: null,
          language: null,
          template: [
            { enabled: true, insert: 'content', before: '', after: '' },
            { enabled: true, insert: 'footer', before: '', after: '', footerId: 'f3' }, // Empty content
          ],
        },
        {
          id: 't5',
          name: 'Template with Author Comment',
          order: 0,
          postType: null,
          language: null,
          template: [
            { enabled: true, insert: 'content', before: '', after: '' },
            { enabled: true, insert: 'authorComment', before: 'Note: ', after: '' },
          ],
        },
      ],
    },
  };

  const mockData = {
    content: 'Main Content',
    authorComment: 'Author Note',
  };

  it('should use specific footer when selected in block', () => {
    const channelWithT1 = {
      ...mockChannel,
      preferences: {
        ...mockChannel.preferences,
        templates: [{ ...mockChannel.preferences.templates[0], isDefault: true }],
      },
    };

    // @ts-ignore
    const result = SocialPostingBodyFormatter.format(mockData, channelWithT1);
    expect(result).toContain('Main Content');
    expect(result).toContain('Footer 1 Content');
    expect(result).not.toContain('Default Footer Content');
  });

  it('should use default footer when no footer selected in block (footerId is null)', () => {
    const channelWithT2 = {
      ...mockChannel,
      preferences: {
        ...mockChannel.preferences,
        templates: [{ ...mockChannel.preferences.templates[1], isDefault: true }],
      },
    };

    // @ts-ignore
    const result = SocialPostingBodyFormatter.format(mockData, channelWithT2);
    expect(result).toContain('Main Content');
    expect(result).toContain('Default Footer Content');
    expect(result).not.toContain('Footer 1 Content');
  });

  it('should not append footer if selected footer is not found', () => {
    const channelWithT3 = {
      ...mockChannel,
      preferences: {
        ...mockChannel.preferences,
        templates: [{ ...mockChannel.preferences.templates[2], isDefault: true }],
      },
    };

    // @ts-ignore
    const result = SocialPostingBodyFormatter.format(mockData, channelWithT3);
    expect(result).toContain('Main Content');
    expect(result).not.toContain('Footer 1 Content');
    expect(result).not.toContain('Default Footer Content');
  });

  it('should use default footer if no template matched', () => {
    const channelNoTemplates = {
      ...mockChannel,
      preferences: {
        ...mockChannel.preferences,
        templates: [],
      },
    };

    // @ts-ignore
    const result = SocialPostingBodyFormatter.format(mockData, channelNoTemplates);
    expect(result).toContain('Main Content');
    expect(result).toContain('Default Footer Content');
  });

  it('should skip footer if content is empty', () => {
    const channelWithT4 = {
      ...mockChannel,
      preferences: {
        ...mockChannel.preferences,
        templates: [{ ...mockChannel.preferences.templates[3], isDefault: true }],
      },
    };

    // @ts-ignore
    const result = SocialPostingBodyFormatter.format(mockData, channelWithT4);
    expect(result).toBe('Main Content');
  });

  it('should include author comment correctly', () => {
    const channelWithT5 = {
      ...mockChannel,
      preferences: {
        ...mockChannel.preferences,
        templates: [{ ...mockChannel.preferences.templates[4], isDefault: true }],
      },
    };

    // @ts-ignore
    const result = SocialPostingBodyFormatter.format(mockData, channelWithT5);
    expect(result).toBe('Main Content\n\nNote: Author Note');
  });
});
