import { PostType } from '../../../generated/prisma/client.js';
import { 
  TagsFormatter, 
  TagCase
} from './tags.formatter.js';

export interface TemplateBlock {
  enabled: boolean;
  insert: 'title' | 'content' | 'description' | 'tags';
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
}

export interface PublicationData {
  title?: string | null;
  content?: string | null;
  description?: string | null;
  tags?: string | null;
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
      { enabled: false, insert: 'title', before: '', after: '\n\n' },
      { enabled: true, insert: 'content', before: '', after: '' },
      { enabled: true, insert: 'description', before: '\n\n', after: '' },
      { enabled: true, insert: 'tags', before: '\n\n', after: '' },
    ];
  }

  /**
   * Formats the body text based on channel templates or default template.
   */
  static format(data: PublicationData, channel: { language: string; preferences?: any }): string {
    const templates: ChannelPostTemplate[] = channel.preferences?.templates || [];
    
    // 1. Try to find the best matching template
    // Priority: 1. Exact postType and language, 2. Exact postType, 3. Exact language, 4. Any generic template
    const template = this.findBestTemplate(templates, data.postType, data.language || channel.language);
    
    const blocks = template ? template.template : this.getDefaultBlocks();
    
    let result = '';

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
      }

      if (value && value.trim()) {
        result += block.before + value.trim() + block.after;
      }
    }

    // Append Footer
    const footers: ChannelFooter[] = channel.preferences?.footers || [];
    let footerObj: ChannelFooter | undefined;

    if (template && template.footerId) {
       // A specific footer is selected
       footerObj = footers.find(f => f.id === template.footerId);
    } else {
       // No specific footer, try to find default (if not explicitly set to "no footer" - currently null means "default" in UI)
       // NOTE: If we want "Null" to mean "No Footer", we would need a specific ID for "No Footer" or different logic.
       // Based on requirements found in UI code (value: null, label: 'Default'), null means use Default.
       footerObj = footers.find(f => f.isDefault);
    }

    if (footerObj && footerObj.content && footerObj.content.trim()) {
      result += '\n\n' + footerObj.content.trim();
    }

    return result.trim();
  }

  private static findBestTemplate(
    templates: ChannelPostTemplate[],
    postType?: PostType,
    language?: string,
  ): ChannelPostTemplate | null {
    if (!templates.length) return null;

    // Filter templates that match postType (if it's set) or have null postType
    const matchingType = templates.filter(t => !t.postType || t.postType === postType);
    
    // Filter by language
    const matchingLang = matchingType.filter(t => !t.language || t.language === language);

    if (!matchingLang.length) return null;

    // Sort by specificity: templates with both postType and language first, then either, then neither
    return matchingLang.sort((a, b) => {
      const scoreA = (a.postType ? 2 : 0) + (a.language ? 1 : 0);
      const scoreB = (b.postType ? 2 : 0) + (b.language ? 1 : 0);
      return scoreB - scoreA || (a.order - b.order);
    })[0];
  }
}
