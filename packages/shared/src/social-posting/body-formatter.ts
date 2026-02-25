import { TagsFormatter, type TagCase } from './tags-formatter.js';

export interface TemplateBlock {
  id: string;
  enabled: boolean;
  insert: 'title' | 'content' | 'tags' | 'authorComment' | 'authorSignature' | 'footer' | 'custom';
  before: string;
  after: string;
  tagCase?: TagCase;
  content?: string;
}

export interface BlockOverride {
  enabled?: boolean;
  before?: string;
  after?: string;
  content?: string;
  tagCase?: TagCase;
}

export interface ChannelTemplateVariation {
  projectTemplateId: string;
  excluded?: boolean;
  overrides?: Record<string, BlockOverride>;
}

export interface PublicationData {
  title?: string | null;
  content?: string | null;
  tags?: string | null;
  authorComment?: string | null;
  authorSignature?: string | null;
  postType?: string;
  language?: string;
}

export interface ProjectTemplateData {
  id: string;
  name: string;
  postType: string | null;
  order: number;
  template: TemplateBlock[];
}

export interface TemplateResolutionMeta {
  preferredProjectTemplateId?: string | null;
  resolvedVariationId?: string | null;
  resolvedProjectTemplateId?: string | null;
  resolution:
    | 'preferred_template_channel_default'
    | 'preferred_template_first_variation'
    | 'channel_default'
    | 'fallback_default_blocks'
    | 'missing_project_template_fallback';
  hasOverrides?: boolean;
}

export class SocialPostingBodyFormatter {
  private static getDefaultBlocks(): TemplateBlock[] {
    return [
      { id: '8d2f00e0-32b4-4e94-9b2c-63e8a7287961', enabled: false, insert: 'title', before: '', after: '' },
      { id: '9a1c2d3e-4f5a-6b7c-8d9e-0a1b2c3d4e5f', enabled: true, insert: 'content', before: '', after: '' },
      { id: '1b2c3d4e-5f6a-7b8c-9d0e-1f2a3b4c5d6e', enabled: true, insert: 'authorComment', before: '', after: '' },
      { id: '2c3d4e5f-6a7b-8c9d-0e1f-2a3b4c5d6e7a', enabled: true, insert: 'authorSignature', before: '', after: '' },
      { id: '3d4e5f6a-7b8c-9d0e-1f2a-3b4c5d6e7a8b', enabled: true, insert: 'tags', before: '', after: '', tagCase: 'snake_case' },
      { id: '4e5f6a7b-8c9d-0e1f-2a3b-4c5d6e7a8b9c', enabled: false, insert: 'custom', before: '', after: '', content: '' },
      { id: '5f6a7b8c-9d0e-1f2a-3b4c-5d6e7a8b9c0d', enabled: true, insert: 'footer', before: '', after: '', content: '' },
    ];
  }

  static buildEffectiveBlocks(
    projectBlocks: TemplateBlock[],
    overrides?: Record<string, BlockOverride>,
  ): TemplateBlock[] {
    if (!overrides) return projectBlocks;

    return projectBlocks.map(block => {
      // Try to find override by stable block ID first (Point 2)
      // Fallback to block.insert for legacy support during migration
      const override = overrides[block.id] || overrides[block.insert];
      if (!override) return block;

      return {
        ...block,
        enabled: override.enabled !== undefined ? override.enabled : block.enabled,
        before: override.before !== undefined ? override.before : block.before,
        after: override.after !== undefined ? override.after : block.after,
        content: override.content !== undefined ? override.content : block.content,
        tagCase: override.tagCase !== undefined ? override.tagCase : block.tagCase,
      };
    });
  }

  static formatWithMeta(options: {
    data: PublicationData;
    channel: { preferences?: any };
    projectTemplates?: ProjectTemplateData[];
    preferredProjectTemplateId?: string | null;
  }): { body: string; template: TemplateResolutionMeta };
  static formatWithMeta(
    data: PublicationData,
    channel: { preferences?: any },
    projectTemplates?: ProjectTemplateData[],
    preferredProjectTemplateId?: string | null,
  ): { body: string; template: TemplateResolutionMeta };
  static formatWithMeta(
    dataOrOptions:
      | {
          data: PublicationData;
          channel: { preferences?: any };
          projectTemplates?: ProjectTemplateData[];
          preferredProjectTemplateId?: string | null;
        }
      | PublicationData,
    channelArg?: { preferences?: any },
    projectTemplatesArg?: ProjectTemplateData[],
    preferredProjectTemplateIdArg?: string | null,
  ): { body: string; template: TemplateResolutionMeta } {
    const options =
      typeof dataOrOptions === 'object' && dataOrOptions !== null && 'data' in dataOrOptions
        ? dataOrOptions
        : {
            data: dataOrOptions as PublicationData,
            channel: channelArg ?? {},
            projectTemplates: projectTemplatesArg,
            preferredProjectTemplateId: preferredProjectTemplateIdArg,
          };

    const { data, channel, projectTemplates, preferredProjectTemplateId } = options;

    const preferences =
      typeof channel.preferences === 'string'
        ? JSON.parse(channel.preferences)
        : channel.preferences;

    // Support both legacy JSON variations and new table variations (passed in as channel.templateVariations)
    const variations: ChannelTemplateVariation[] = (channel as any).templateVariations || preferences?.templates || [];

    let resolution: TemplateResolutionMeta['resolution'] = 'fallback_default_blocks';

    const preferredTplId = preferredProjectTemplateId ?? null;

    const findProjectTemplate = (id: string | null | undefined) =>
      id && projectTemplates ? projectTemplates.find(pt => pt.id === id) : undefined;

    const pickDefaultProjectTemplate = () => {
      if (!projectTemplates || projectTemplates.length === 0) return undefined;
      return [...projectTemplates].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
    };

    const resolvedProjectTemplate =
      preferredTplId && projectTemplates
        ? findProjectTemplate(preferredTplId)
        : pickDefaultProjectTemplate();

    if (preferredTplId && projectTemplates && !resolvedProjectTemplate) {
      resolution = 'missing_project_template_fallback';
    } else if (preferredTplId) {
      resolution = 'preferred_template_first_variation';
    } else if (resolvedProjectTemplate) {
      resolution = 'channel_default';
    }

    const resolvedProjectTemplateId = resolvedProjectTemplate?.id ?? null;
    const variation = resolvedProjectTemplateId
      ? variations.find(v => v.projectTemplateId === resolvedProjectTemplateId && !v.excluded)
      : null;

    const blocks = resolvedProjectTemplate
      ? this.buildEffectiveBlocks(resolvedProjectTemplate.template, variation?.overrides)
      : this.getDefaultBlocks();

    return {
      body: this.renderBlocks(data, blocks),
      template: {
        preferredProjectTemplateId: preferredTplId,
        resolvedVariationId: variation ? variation.projectTemplateId : null,
        resolvedProjectTemplateId,
        resolution,
        hasOverrides: variation?.overrides ? Object.keys(variation.overrides).length > 0 : false,
      },
    };
  }

  static format(options: {
    data: PublicationData;
    channel: { preferences?: any };
    projectTemplates?: ProjectTemplateData[];
    preferredProjectTemplateId?: string | null;
  }): string;
  static format(
    data: PublicationData,
    channel: { preferences?: any },
    projectTemplates?: ProjectTemplateData[],
    preferredProjectTemplateId?: string | null,
  ): string;
  static format(
    dataOrOptions:
      | {
          data: PublicationData;
          channel: { preferences?: any };
          projectTemplates?: ProjectTemplateData[];
          preferredProjectTemplateId?: string | null;
        }
      | PublicationData,
    channelArg?: { preferences?: any },
    projectTemplatesArg?: ProjectTemplateData[],
    preferredProjectTemplateIdArg?: string | null,
  ): string {
    if (typeof dataOrOptions === 'object' && dataOrOptions !== null && 'data' in dataOrOptions) {
      return this.formatWithMeta(dataOrOptions).body;
    }

    return this.formatWithMeta(
      dataOrOptions as PublicationData,
      channelArg ?? {},
      projectTemplatesArg,
      preferredProjectTemplateIdArg,
    ).body;
  }

  private static renderBlocks(data: PublicationData, blocks: TemplateBlock[]): string {
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
        case 'footer':
          value = block.content || '';
          break;
      }

      const trimmedValue = value.trim();
      if (trimmedValue) {
        const blockParts = [block.before || '', trimmedValue, block.after || ''];
        formattedBlocks.push(blockParts.join(''));
      }
    }

    const result = formattedBlocks.join('\n\n');
    return result.trim().replace(/\n{3,}/g, '\n\n');
  }
}
