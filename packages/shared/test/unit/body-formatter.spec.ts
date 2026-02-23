import { describe, it, expect } from '@jest/globals';
import { SocialPostingBodyFormatter, type TemplateBlock, type ProjectTemplateData } from '../../src/social-posting/body-formatter.js';

describe('SocialPostingBodyFormatter', () => {
  const mockData = {
    title: 'Post Title',
    content: 'Post Content',
    tags: 'tag1, tag2',
    authorComment: 'Comment',
    authorSignature: 'Signature',
  };

  const mockProjectTemplates: ProjectTemplateData[] = [
    {
      id: 'template-1',
      name: 'Default Template',
      postType: 'standard',
      order: 1,
      template: [
        { enabled: true, insert: 'title', before: 'Title: ', after: '' },
        { enabled: true, insert: 'content', before: '', after: '' },
        { enabled: true, insert: 'tags', before: '\nTags: ', after: '', tagCase: 'snake_case' },
      ],
    },
    {
        id: 'template-2',
        name: 'Simple Template',
        postType: 'standard',
        order: 2,
        template: [
          { enabled: true, insert: 'content', before: '', after: '' },
        ],
      }
  ];

  describe('buildEffectiveBlocks', () => {
    it('should return project blocks if no overrides', () => {
      const blocks: TemplateBlock[] = [{ enabled: true, insert: 'content', before: '', after: '' }];
      expect(SocialPostingBodyFormatter.buildEffectiveBlocks(blocks)).toEqual(blocks);
    });

    it('should apply overrides correctly', () => {
      const blocks: TemplateBlock[] = [
        { enabled: true, insert: 'content', before: '', after: '' },
        { enabled: false, insert: 'title', before: '', after: '' },
      ];
      const overrides = {
        content: { before: 'START: ' },
        title: { enabled: true },
      };
      const effective = SocialPostingBodyFormatter.buildEffectiveBlocks(blocks, overrides);
      
      expect(effective[0].before).toBe('START: ');
      expect(effective[1].enabled).toBe(true);
    });
  });

  describe('formatWithMeta', () => {
    it('should use default blocks if no project templates provided', () => {
      const result = SocialPostingBodyFormatter.formatWithMeta({
        data: mockData,
        channel: {},
      });

      expect(result.body).toContain(mockData.content);
      expect(result.body).toContain('#tag1 #tag2');
      expect(result.template.resolution).toBe('fallback_default_blocks');
    });

    it('should use the project template with lowest order by default', () => {
        const result = SocialPostingBodyFormatter.formatWithMeta({
          data: mockData,
          channel: {},
          projectTemplates: mockProjectTemplates,
        });
  
        expect(result.body).toContain('Title: Post Title');
        expect(result.template.resolution).toBe('channel_default');
        expect(result.template.resolvedProjectTemplateId).toBe('template-1');
    });

    it('should respect preferredProjectTemplateId', () => {
        const result = SocialPostingBodyFormatter.formatWithMeta({
          data: mockData,
          channel: {},
          projectTemplates: mockProjectTemplates,
          preferredProjectTemplateId: 'template-2',
        });
  
        expect(result.body).not.toContain('Title:');
        expect(result.body).toBe(mockData.content);
        expect(result.template.resolution).toBe('preferred_template_first_variation');
        expect(result.template.resolvedProjectTemplateId).toBe('template-2');
    });

    it('should apply channel overrides from preferences', () => {
        const channel = {
            preferences: JSON.stringify({
                templates: [
                    {
                        projectTemplateId: 'template-1',
                        overrides: {
                            title: { enabled: false }
                        }
                    }
                ]
            })
        };

        const result = SocialPostingBodyFormatter.formatWithMeta({
            data: mockData,
            channel: channel,
            projectTemplates: mockProjectTemplates,
        });

        expect(result.body).not.toContain('Title:');
        expect(result.template.hasOverrides).toBe(true);
    });

    it('should handle excluded variations', () => {
        const channel = {
            preferences: {
                templates: [
                    {
                        projectTemplateId: 'template-1',
                        excluded: true
                    }
                ]
            }
        };

        const result = SocialPostingBodyFormatter.formatWithMeta({
            data: mockData,
            channel: channel,
            projectTemplates: mockProjectTemplates,
        });

        // If one is excluded, it still resolves to it but blocks from template itself are used (no variation overrides)
        expect(result.body).toContain('Title: Post Title');
    });
  });

  describe('renderBlocks', () => {
    it('should join blocks with double newlines and trim extra', () => {
        const result = SocialPostingBodyFormatter.format({
            data: { content: 'line 1\n\n\nline 2' },
            channel: {}
        });
        expect(result).toBe('line 1\n\nline 2');
    });
  });
});
