import { SocialPostingBodyFormatter } from '../../src/modules/social-posting/utils/social-posting-body.formatter.js';
import { PostType } from '../../src/generated/prisma/client.js';

describe('SocialPostingBodyFormatter', () => {
  const mockChannel = {
    language: 'en-US',
    preferences: {
      footers: [
        { id: 'f1', name: 'Footer 1', content: 'Footer 1 Content', isDefault: false },
        { id: 'f2', name: 'Default Footer', content: 'Default Footer Content', isDefault: true },
        // @ts-ignore
        { id: 'f3', name: 'Empty Footer', content: '', isDefault: false }
      ],
      templates: [
        {
          id: 't1',
          name: 'Template 1',
          order: 0,
          postType: null,
          language: null,
          footerId: 'f1',
          template: [
            { enabled: true, insert: 'content', before: '', after: '' }
          ]
        },
        {
          id: 't2',
          name: 'Template 2',
          order: 0,
          postType: null,
          language: null,
          footerId: null, // Should use default
          template: [
            { enabled: true, insert: 'content', before: '', after: '' }
          ]
        },
        {
          id: 't3',
          name: 'Template 3',
          order: 0,
          postType: null,
          language: null,
          footerId: 'non-existent', // Should handle gracefully
          template: [
            { enabled: true, insert: 'content', before: '', after: '' }
          ]
        },
        {
          id: 't4',
          name: 'Template 4',
          order: 0,
          postType: null,
          language: null,
          footerId: 'f3', // Empty content
          template: [
            { enabled: true, insert: 'content', before: '', after: '' }
          ]
        }
      ]
    }
  };

  const mockData = {
    content: 'Main Content'
  };

  it('should use specific footer when selected in template', () => {
    const channelWithT1 = {
      ...mockChannel,
      preferences: {
        ...mockChannel.preferences,
        templates: [mockChannel.preferences.templates[0]]
      }
    };

    // @ts-ignore
    const result = SocialPostingBodyFormatter.format(mockData, channelWithT1);
    expect(result).toContain('Main Content');
    expect(result).toContain('Footer 1 Content');
    expect(result).not.toContain('Default Footer Content');
  });

  it('should use default footer when no footer selected in template (footerId is null)', () => {
    const channelWithT2 = {
      ...mockChannel,
      preferences: {
        ...mockChannel.preferences,
        templates: [mockChannel.preferences.templates[1]] // t2 has footerId: null
      }
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
        templates: [mockChannel.preferences.templates[2]] // t3 has non-existent footerId
      }
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
         templates: []
       }
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
        templates: [mockChannel.preferences.templates[3]] // t4 has empty footer
      }
    };

    // @ts-ignore
    const result = SocialPostingBodyFormatter.format(mockData, channelWithT4);
    expect(result).toBe('Main Content');
  });
});
