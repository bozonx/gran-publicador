import { describe, it, expect, vi } from 'vitest'
import { SocialPostingBodyFormatter } from '../../app/utils/bodyFormatter'

describe('SocialPostingBodyFormatter', () => {
  const mockChannel = {
    preferences: {
      footers: [
        { id: 'f1', name: 'Footer 1', content: 'Footer 1 Content', isDefault: false },
        { id: 'f2', name: 'Default Footer', content: 'Default Footer Content', isDefault: true },
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
            { enabled: true, insert: 'footer', before: '', after: '', footerId: null },
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
  }

  const mockData = {
    content: 'Main Content',
    authorComment: 'Author Note',
    authorSignature: 'John Doe',
  }

  it('should use specific footer when selected in block', () => {
    const channelWithT1 = {
      ...mockChannel,
      preferences: {
        ...mockChannel.preferences,
        templates: [{ ...mockChannel.preferences.templates[0], isDefault: true }],
      },
    }

    const result = SocialPostingBodyFormatter.format(mockData, channelWithT1)
    expect(result).toContain('Main Content')
    expect(result).toContain('Footer 1 Content')
    expect(result).not.toContain('Default Footer Content')
  })

  it('should use default footer when no footer selected in block', () => {
    const channelWithT2 = {
      ...mockChannel,
      preferences: {
        ...mockChannel.preferences,
        templates: [{ ...mockChannel.preferences.templates[1], isDefault: true }],
      },
    }

    const result = SocialPostingBodyFormatter.format(mockData, channelWithT2)
    expect(result).toContain('Main Content')
    expect(result).toContain('Default Footer Content')
  })

  it('should use default system blocks if no template is default', () => {
    const channelNoDefault = {
      ...mockChannel,
      preferences: {
        ...mockChannel.preferences,
        templates: mockChannel.preferences.templates.map(t => ({ ...t, isDefault: false })),
      },
    }

    const result = SocialPostingBodyFormatter.format(mockData, channelNoDefault)
    // Default blocks include: content, authorComment, authorSignature, tags, footer (default)
    expect(result).toContain('Main Content')
    expect(result).toContain('Author Note')
    expect(result).toContain('John Doe')
    expect(result).toContain('Default Footer Content')
  })

  it('should NOT replace {{authorSignature}} placeholder', () => {
    const channelWithCustom = {
      preferences: {
        templates: [
          {
            id: 't_custom',
            name: 'Template with Placeholder',
            order: 0,
            isDefault: true,
            template: [
              {
                enabled: true,
                insert: 'custom',
                before: '',
                after: '',
                content: 'Written by {{authorSignature}}',
              },
            ],
          },
        ],
      },
    }

    const result = SocialPostingBodyFormatter.format(mockData, channelWithCustom)
    expect(result).toBe('Written by {{authorSignature}}')
  })

  it('should support explicit footerOverride', () => {
    const result = SocialPostingBodyFormatter.format(mockData, mockChannel, null, 'f1')
    expect(result).toContain('Main Content')
    expect(result).toContain('Footer 1 Content')
  })

  it('should skip footer if footerOverride is non-existent', () => {
    const result = SocialPostingBodyFormatter.format(mockData, mockChannel, null, 'non-existent')
    expect(result).toContain('Main Content')
    expect(result).not.toContain('Footer 1 Content')
    expect(result).not.toContain('Default Footer Content')
  })

  it('should respect enabled/disabled blocks in template', () => {
    const channelWithMixedBlocks = {
      preferences: {
        templates: [
          {
            id: 't_mixed',
            name: 'Mixed Blocks',
            isDefault: true,
            template: [
              { enabled: false, insert: 'title', before: 'Title: ', after: '' },
              { enabled: true, insert: 'content', before: '', after: '' },
              { enabled: false, insert: 'authorComment', before: 'Comment: ', after: '' },
            ],
          },
        ],
      },
    }

    const data = {
      title: 'Post Title',
      content: 'Hello World',
      authorComment: 'Hidden Comment',
    }

    const result = SocialPostingBodyFormatter.format(data, channelWithMixedBlocks)
    expect(result).toBe('Hello World')
    expect(result).not.toContain('Post Title')
    expect(result).not.toContain('Hidden Comment')
  })

  it('should format tags correctly with default snake_case', () => {
    const data = {
      content: 'Post',
      tags: 'First Tag, SecondTag',
    }
    // Default system template includes tags with snake_case
    const result = SocialPostingBodyFormatter.format(data, { preferences: {} })
    expect(result).toContain('#first_tag')
    expect(result).toContain('#second_tag')
  })
})
