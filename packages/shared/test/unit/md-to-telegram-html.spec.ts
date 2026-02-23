import { describe, it, expect } from '@jest/globals';
import { mdToTelegramHtml } from '../../src/social-posting/md-to-telegram-html.js';

describe('mdToTelegramHtml', () => {
  it('should return empty string for empty input', () => {
    expect(mdToTelegramHtml('')).toBe('');
  });

  it('should format bold and italic', () => {
    expect(mdToTelegramHtml('**bold** and *italic*')).toBe('<b>bold</b> and <i>italic</i>');
  });

  it('should format links', () => {
    expect(mdToTelegramHtml('[Google](https://google.com)')).toBe('<a href="https://google.com">Google</a>');
  });

  it('should format inline code', () => {
    expect(mdToTelegramHtml('`code`')).toBe('<code>code</code>');
  });

  it('should format code blocks with language', () => {
    const md = '```typescript\nconst a = 1;\n```';
    expect(mdToTelegramHtml(md)).toBe('<pre><code class="language-typescript">const a = 1;</code></pre>');
  });

  it('should format blockquotes', () => {
    expect(mdToTelegramHtml('> Quote')).toBe('<blockquote>Quote</blockquote>');
  });

  it('should format unordered lists', () => {
    const md = '* Item 1\n* Item 2';
    // Telegram list items are rendered with dots
    expect(mdToTelegramHtml(md)).toContain('• Item 1');
    expect(mdToTelegramHtml(md)).toContain('• Item 2');
  });

  it('should format ordered lists', () => {
    const md = '1. First\n2. Second';
    expect(mdToTelegramHtml(md)).toContain('1. First');
    expect(mdToTelegramHtml(md)).toContain('2. Second');
  });

  it('should support telegram spoilers', () => {
    expect(mdToTelegramHtml('||secret||')).toBe('<tg-spoiler>secret</tg-spoiler>');
  });

  it('should escape HTML characters', () => {
    expect(mdToTelegramHtml('2 < 3 & 4 > 1')).toBe('2 &lt; 3 &amp; 4 &gt; 1');
  });

  it('should pass through allowed HTML tags', () => {
    expect(mdToTelegramHtml('<tg-spoiler>allowed</tg-spoiler>')).toBe('<tg-spoiler>allowed</tg-spoiler>');
    expect(mdToTelegramHtml('<b>bold</b>')).toBe('<b>bold</b>');
  });

  it('should escape not allowed HTML tags', () => {
    expect(mdToTelegramHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('should handle nested elements', () => {
    expect(mdToTelegramHtml('**bold [link](http://ex.com)**')).toBe('<b>bold <a href="http://ex.com">link</a></b>');
  });
});
