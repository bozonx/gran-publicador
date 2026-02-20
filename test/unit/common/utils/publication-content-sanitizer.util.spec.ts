import { sanitizePublicationMarkdownForStorage } from '../../../../src/common/utils/publication-content-sanitizer.util.js';
import { describe, it, expect } from '@jest/globals';

describe('sanitizePublicationMarkdownForStorage', () => {
  it('should discard dangerous tags but keep their text content', () => {
    const input = 'ok<script>alert(1)</script>done';
    expect(sanitizePublicationMarkdownForStorage(input)).toBe('okalert(1)done');
  });

  it('should unwrap <a> tags preserving inner text', () => {
    const input = 'go <a href="https://example.com">there</a> now';
    expect(sanitizePublicationMarkdownForStorage(input)).toBe('go there now');
  });

  it('should keep custom tags', () => {
    const input = '<foo-bar>ok</foo-bar>';
    expect(sanitizePublicationMarkdownForStorage(input)).toBe('<foo-bar>ok</foo-bar>');
  });

  it('should keep underline tag', () => {
    const input = 'a <u>u</u> b';
    expect(sanitizePublicationMarkdownForStorage(input)).toBe('a <u>u</u> b');
  });

  it('should remove on* attributes from allowed and custom tags', () => {
    const input = '<u onclick="alert(1)">x</u><foo-bar onerror=alert(1)>y</foo-bar>';
    expect(sanitizePublicationMarkdownForStorage(input)).toBe('<u>x</u><foo-bar>y</foo-bar>');
  });
});
