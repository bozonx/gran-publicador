export type TagCase =
  | 'camelCase'
  | 'pascalCase'
  | 'snake_case'
  | 'SNAKE_CASE'
  | 'kebab-case'
  | 'KEBAB-CASE'
  | 'lower_case'
  | 'upper_case'
  | 'none';

export interface TagFormatOptions {
  tagCase?: TagCase;
}

export class TagsFormatter {
  static toArray(tags: string | null | undefined, options: TagFormatOptions = {}): string[] {
    if (!tags) return [];

    const tagCase = options.tagCase || 'none';

    const chunks = tags
      .split(',')
      .map(c => c.trim())
      .filter(c => c.length > 0);

    const individualTags: string[] = [];

    for (const chunk of chunks) {
      individualTags.push(chunk.startsWith('#') ? chunk.slice(1) : chunk);
    }

    if (individualTags.length === 0) return [];

    return individualTags.map(tag => {
      let result = tag;
      if (tagCase !== 'none') {
        result = this.convertStringCase(result, tagCase);
      }
      return `#${result}`;
    });
  }

  static format(tags: string | null | undefined, options: TagFormatOptions = {}): string {
    return this.toArray(tags, options).join(' ');
  }

  private static convertStringCase(str: string, targetCase: TagCase): string {
    const words = str
      .replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2')
      .replace(/[-_]/g, ' ')
      .split(/\s+/)
      .map(w => w.toLowerCase())
      .filter(w => w.length > 0);

    if (words.length === 0) return str;

    switch (targetCase) {
      case 'camelCase':
        return (
          words[0] +
          words
            .slice(1)
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join('')
        );
      case 'pascalCase':
        return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
      case 'snake_case':
        return words.join('_');
      case 'SNAKE_CASE':
        return words.join('_').toUpperCase();
      case 'kebab-case':
        return words.join('-');
      case 'KEBAB-CASE':
        return words.join('-').toUpperCase();
      case 'lower_case':
        return words.join(' ');
      case 'upper_case':
        return words.join(' ').toUpperCase();
      default:
        return str;
    }
  }
}
