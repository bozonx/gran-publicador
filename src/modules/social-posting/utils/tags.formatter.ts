export type TagStringCase = 'camelCase' | 'pascalCase' | 'snake_case' | 'kebab-case' | 'none';
export type TagLetterCase = 'uppercase' | 'lowercase' | 'none';

export interface TagFormatOptions {
  stringCase?: TagStringCase;
  letterCase?: TagLetterCase;
}

export class TagsFormatter {
  /**
   * Formats a string of tags or a single tag based on options.
   * Returns a string of space-separated hashtags.
   */
  static format(tags: string | null | undefined, options: TagFormatOptions = {}): string {
    if (!tags) return '';

    // Split into individual tags
    const individualTags = tags
      .split(/[\s,]+/)
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0)
      .map(tag => tag.startsWith('#') ? tag.slice(1) : tag);

    if (individualTags.length === 0) return '';

    const formattedTags = individualTags.map(tag => {
      let result = tag;

      // 1. Apply string case (camel, snake, etc.)
      if (options.stringCase && options.stringCase !== 'none') {
        result = this.convertStringCase(result, options.stringCase);
      }

      // 2. Apply letter case (upper, lower)
      if (options.letterCase === 'uppercase') {
        result = result.toUpperCase();
      } else if (options.letterCase === 'lowercase') {
        result = result.toLowerCase();
      }

      return `#${result}`;
    });

    return formattedTags.join(' ');
  }

  private static convertStringCase(str: string, targetCase: TagStringCase): string {
    // Break into parts (words) based on common delimiters (space, dash, underscore, or camelCase)
    const words = str
      .replace(/([a-z])([A-Z])/g, '$1 $2') // split camelCase
      .replace(/[-_]/g, ' ')               // replace - and _ with spaces
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 0);

    if (words.length === 0) return str;

    switch (targetCase) {
      case 'camelCase':
        return words[0] + words.slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
      case 'pascalCase':
        return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
      case 'snake_case':
        return words.join('_');
      case 'kebab-case':
        return words.join('-');
      default:
        return str;
    }
  }
}
