import { describe, expect, it } from 'vitest';

import {
  isTextContentEmpty,
  sanitizeContentPreserveMarkdown,
  stripHtmlAndSpecialChars,
} from '../../app/utils/text';

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
        'a b & c < d > e "f"',
      );
    });

    it('collapses whitespace', () => {
      expect(stripHtmlAndSpecialChars('a\n\n\n b\t\t c')).toBe('a b c');
    });
  });

  describe('sanitizeContentPreserveMarkdown', () => {
    it('returns empty string for null/undefined/empty', () => {
      expect(sanitizeContentPreserveMarkdown(null)).toBe('');
      expect(sanitizeContentPreserveMarkdown(undefined)).toBe('');
      expect(sanitizeContentPreserveMarkdown('')).toBe('');
    });

    it('preserves markdown and newlines while stripping html', () => {
      const input = `# header\n\n**bold** _italic_\n\n> cite\n\n---\n\n[link](https://example.com)`;
      expect(sanitizeContentPreserveMarkdown(input)).toBe(input);
    });

    it('handles basic html from editors', () => {
      const input = '<p>hello <b>world</b></p><p>line2<br>line3</p>';
      expect(sanitizeContentPreserveMarkdown(input)).toBe('hello world\n\nline2\nline3');
    });

    it('decodes basic html entities without collapsing newlines', () => {
      const input = 'a&nbsp;b\n\n&lt;tag&gt; &amp; &quot;x&quot;';
      expect(sanitizeContentPreserveMarkdown(input)).toBe('a b\n\n<tag> & "x"');
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
