import { describe, expect, it } from 'vitest';

import { isTextContentEmpty, stripHtmlAndSpecialChars } from '~/utils/text';

describe('utils/text', () => {
  describe('stripHtmlAndSpecialChars', () => {
    it('returns empty string for null/undefined/empty', () => {
      expect(stripHtmlAndSpecialChars(null)).toBe('');
      expect(stripHtmlAndSpecialChars(undefined)).toBe('');
      expect(stripHtmlAndSpecialChars('')).toBe('');
    });

    it('removes markdown formatting, links, code blocks and html tags', () => {
      const input = `# Title\n\n**bold** _italic_ [link](https://example.com)\n\n\`inline\`\n\n\`\`\`\ncode\n\`\`\`\n\n<div>hello</div>`;
      expect(stripHtmlAndSpecialChars(input)).toBe('Title bold italic link inline hello');
    });

    it('decodes basic html entities', () => {
      expect(stripHtmlAndSpecialChars('a&nbsp;b &amp; c &lt; d &gt; e &quot;f&quot;')).toBe(
        'a b & c < d > e "f"'
      );
    });

    it('collapses whitespace', () => {
      expect(stripHtmlAndSpecialChars('a\n\n\n b\t\t c')).toBe('a b c');
    });
  });

  describe('isTextContentEmpty', () => {
    it('returns true for empty-like inputs', () => {
      expect(isTextContentEmpty(null)).toBe(true);
      expect(isTextContentEmpty(undefined)).toBe(true);
      expect(isTextContentEmpty('')).toBe(true);
      expect(isTextContentEmpty('   ')).toBe(true);
      expect(isTextContentEmpty('<p>   </p>')).toBe(true);
      expect(isTextContentEmpty('<div>&nbsp;</div>')).toBe(true);
    });

    it('returns false for meaningful text', () => {
      expect(isTextContentEmpty('<p>Hello</p>')).toBe(false);
    });
  });
});
