import { describe, it, expect } from '@jest/globals';
import { preformatMarkdownForPlatform } from '../../src/social-posting/md-preformatter.js';

describe('md-preformatter', () => {
  it('should return original markdown by default', () => {
    const md = '# Hello';
    expect(preformatMarkdownForPlatform({ platform: 'TELEGRAM' as any, markdown: md })).toBe(md);
  });

  it('should handle null/undefined markdown', () => {
    expect(preformatMarkdownForPlatform({ platform: 'TELEGRAM' as any, markdown: null as any })).toBe('');
  });
});
