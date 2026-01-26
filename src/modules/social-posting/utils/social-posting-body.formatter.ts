import type { PostType } from '../../../generated/prisma/index.js';
import { TagsFormatter, type TagCase } from './tags.formatter.js';

export interface TemplateBlock {
  enabled: boolean;
  insert: 'title' | 'content' | 'tags' | 'authorComment' | 'authorSignature' | 'footer' | 'custom';
  before: string;
  after: string;
  tagCase?: TagCase;
  footerId?: string | null;
  content?: string;
}

export interface ChannelFooter {
  id: string;
  name: string;
  content: string;
  isDefault: boolean;
}

export interface ChannelPostTemplate {
  id: string;
  name: string;
  order: number;
  postType: PostType | null;
  language: string | null;
  template: TemplateBlock[];
  isDefault?: boolean;
}

export interface PublicationData {
  title?: string | null;
  content?: string | null;
  tags?: string | null;
  authorComment?: string | null;
  postType?: PostType;
  language?: string;
  authorSignature?: string | null;
}

export class SocialPostingBodyFormatter {
  /**
   * Default template blocks as defined in the requirements and UI.
   * - Title: disabled by default
   * - Content: enabled
   * - Author Comment: enabled
   * - Tags: enabled (snake_case)
   * - Custom: enabled (empty)
   * - Footer: enabled (default footer)
   */
  private static getDefaultBlocks(): TemplateBlock[] {
    return [
      { enabled: false, insert: 'title', before: '', after: '' },
      { enabled: true, insert: 'content', before: '', after: '' },
      { enabled: true, insert: 'authorComment', before: '', after: '' },
      { enabled: true, insert: 'authorSignature', before: '', after: '' },
      { enabled: true, insert: 'tags', before: '', after: '', tagCase: 'snake_case' },
      { enabled: true, insert: 'custom', before: '', after: '', content: '' },
      { enabled: true, insert: 'footer', before: '', after: '' },
    ];
  }

  /**
   * Formats the body text based on channel templates or default template.
   */
  static format(
    data: PublicationData,
    channel: { language: string; preferences?: any },
    templateOverride?: { id: string } | null,
  ): string {
    const templates: ChannelPostTemplate[] = channel.preferences?.templates || [];

    let template: ChannelPostTemplate | null | undefined = null;

    // 1. Explicit selection (Highest Priority)
    if (templateOverride?.id) {
      template = templates.find(t => t.id === templateOverride.id);
    }

    // 2. Channel Default
    if (!template) {
      template = templates.find(t => t.isDefault);
    }

    const blocks = template ? template.template : this.getDefaultBlocks();

    const formattedBlocks: string[] = [];

    for (const block of blocks) {
      if (!block.enabled) continue;

      let value = '';
      switch (block.insert) {
        case 'title':
          value = data.title || '';
          break;
        case 'content':
          value = data.content || '';
          break;
        case 'tags':
          value = TagsFormatter.format(data.tags, {
            tagCase: block.tagCase,
          });
          break;
        case 'authorComment':
          value = data.authorComment || '';
          break;
        case 'authorSignature':
          value = data.authorSignature || '';
          break;
        case 'custom':
          value = block.content || '';
          break;
        case 'footer': {
          const footers: ChannelFooter[] = channel.preferences?.footers || [];
          let footerObj: ChannelFooter | undefined;

          if (block.footerId) {
            footerObj = footers.find(f => f.id === block.footerId);
          } else {
            // Find default footer if none specified in block
            footerObj = footers.find(f => f.isDefault);
          }

          value = footerObj?.content || '';
          break;
        }
      }

      const trimmedValue = value.trim();
      if (trimmedValue) {
        const blockParts = [block.before || '', trimmedValue, block.after || ''];

        formattedBlocks.push(blockParts.join(''));
      }
    }

    // Join all blocks with double newline (one empty line between them)
    let result = formattedBlocks.join('\n\n');

    // Replace placeholders
    const signature = data.authorSignature || '';
    result = result.replace(/\{\{authorSignature\}\}/g, signature);

    return result.trim().replace(/\n{3,}/g, '\n\n');
  }
}
