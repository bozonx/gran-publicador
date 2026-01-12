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
  isDefault?: boolean;
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
  static format(
    data: PublicationData, 
    channel: { language: string; preferences?: any },
    templateOverride?: { id: string } | null
  ): string {
    const templates: ChannelPostTemplate[] = channel.preferences?.templates || [];
    
    let template: ChannelPostTemplate | null | undefined = null;

    // 1. Explicit selection (Highest Priority)
    if (templateOverride?.id) {
      template = templates.find(t => t.id === templateOverride.id);
      
      // If explicit template is not found, user requested to use Default template.
      // We don't fail here, just proceed to look for default.
    }

    // 2. Channel Default (if no explicit found, or explicit was invalid)
    if (!template) {
         template = templates.find(t => t.isDefault);
    }

    // 3. System Default (if even channel default is missing)
    // Implicitly handled: if template is null, we use getDefaultBlocks()
    
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
       // If no specific footer or using System Default, check for Default Footer
       footerObj = footers.find(f => f.isDefault);
    }

    if (footerObj && footerObj.content && footerObj.content.trim()) {
      result += '\n\n' + footerObj.content.trim();
    }

    return result.trim();
  }
}
