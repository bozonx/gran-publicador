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
  /**
   * Formats a string of tags or a single tag based on options.
   * Returns a string of space-separated hashtags.
   */
  static format(tags: string | null | undefined, options: TagFormatOptions = {}): string {
    if (!tags) return '';

    const tagCase = options.tagCase || 'none';

    // 1. Split into chunks by comma
    const chunks = tags
      .split(',')
      .map(c => c.trim())
      .filter(c => c.length > 0);
    const individualTags: string[] = [];

    for (const chunk of chunks) {
      if (tagCase !== 'none') {
        // If we have a case transformation, the whole chunk (even with spaces) is one potential tag
        individualTags.push(chunk.startsWith('#') ? chunk.slice(1) : chunk);
      } else {
        // If no case transformation, split the chunk further by whitespace (standard behavior)
        const subTags = chunk
          .split(/\s+/)
          .map(t => t.trim())
          .filter(t => t.length > 0)
          .map(t => (t.startsWith('#') ? t.slice(1) : t));
        individualTags.push(...subTags);
      }
    }

    if (individualTags.length === 0) return '';

    const formattedTags = individualTags.map(tag => {
      let result = tag;

      if (tagCase !== 'none') {
        result = this.convertStringCase(result, tagCase);
      }

      return `#${result}`;
    });

    return formattedTags.join(' ');
  }

  private static convertStringCase(str: string, targetCase: TagCase): string {
    // Break into parts (words) based on common delimiters
    // Use Unicode-aware regex for camelCase splitting (\p{Ll} is lower, \p{Lu} is upper)
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
