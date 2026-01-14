import { PostType } from '../../../generated/prisma/client.js';
import { 
  TagsFormatter, 
  TagCase
} from './tags.formatter.js';

export interface TemplateBlock {
  enabled: boolean;
  insert: 'title' | 'content' | 'description' | 'tags' | 'authorComment';
  before: string;
  after: string;
  tagCase?: TagCase;
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
  footerId?: string | null;
  template: TemplateBlock[];
  isDefault?: boolean;
}

export interface PublicationData {
  title?: string | null;
  content?: string | null;
  description?: string | null;
  tags?: string | null;
  authorComment?: string | null;
  postType?: PostType;
  language?: string;
}

export class SocialPostingBodyFormatter {
  /**
   * Default template blocks as defined in the requirements and UI.
   * - Title: disabled by default
   * - Content: enabled
   * - Description: enabled (with \n\n before)
   * - Tags: enabled (with \n\n before)
   */
  private static getDefaultBlocks(): TemplateBlock[] {
    return [
      { enabled: false, insert: 'title', before: '', after: '' },
      { enabled: true, insert: 'content', before: '', after: '' },
      { enabled: true, insert: 'authorComment', before: '', after: '' },
      { enabled: true, insert: 'description', before: '', after: '' },
      { enabled: true, insert: 'tags', before: '', after: '' },
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
    const templates: ChannelPostTemplate[] =
      channel.preferences?.templates || [];

    let template: ChannelPostTemplate | null | undefined = null;

    // 1. Explicit selection (Highest Priority)
    if (templateOverride?.id) {
      template = templates.find((t) => t.id === templateOverride.id);
    }

    // 2. Channel Default
    if (!template) {
      template = templates.find((t) => t.isDefault);
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
        case 'description':
          value = data.description || '';
          break;
        case 'tags':
          value = TagsFormatter.format(data.tags, {
            tagCase: block.tagCase,
          });
          break;
        case 'authorComment':
          value = data.authorComment || '';
          break;
      }

      const trimmedValue = value.trim();
      if (trimmedValue) {
        // Requirement: if insertion exists, it's placed between text before and after with spaces,
        // and everything is trimmed such that only 1 space remains.
        const blockParts = [
          block.before?.trim(),
          trimmedValue,
          block.after?.trim(),
        ].filter(Boolean);

        formattedBlocks.push(blockParts.join(' '));
      }
    }

    // Join all blocks with double newline (one empty line between them)
    let result = formattedBlocks.join('\n\n');

    // Append Footer
    const footers: ChannelFooter[] = channel.preferences?.footers || [];
    let footerObj: ChannelFooter | undefined;

    if (template && template.footerId) {
      footerObj = footers.find((f) => f.id === template.footerId);
    } else {
      footerObj = footers.find((f) => f.isDefault);
    }

    if (footerObj && footerObj.content && footerObj.content.trim()) {
      const trimmedFooter = footerObj.content.trim();
      if (result) {
        result += '\n\n' + trimmedFooter;
      } else {
        result = trimmedFooter;
      }
    }

    return result.trim().replace(/\n{3,}/g, '\n\n');
  }
}
