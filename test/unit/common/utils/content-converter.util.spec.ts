import { ContentConverter } from '../../../../src/common/utils/content-converter.util.js';

describe('ContentConverter', () => {
  describe('telegramToMd', () => {
    // These tests mirrow existing logic but ensure new utility works same way
    it('should convert bold', () => {
       const text = 'hello world';
       const entities: any[] = [{ type: 'bold', offset: 0, length: 5 }];
       expect(ContentConverter.telegramToMd(text, entities)).toBe('**hello** world');
    });

    it('should convert spoiler to ||', () => {
       const text = 'secret content';
       const entities: any[] = [{ type: 'spoiler', offset: 0, length: 6 }];
       expect(ContentConverter.telegramToMd(text, entities)).toBe('||secret|| content');
    });

    it('should correctly handle entities with trailing spaces and same range (nesting fix)', () => {
       const text = 'bold italic ';
       const entities: any[] = [
         { type: 'bold', offset: 0, length: 12 },
         { type: 'italic', offset: 0, length: 12 }
       ];
       // Should trim the trailing space and nest correctly
       // Result should be **_bold italic_** 
       expect(ContentConverter.telegramToMd(text, entities)).toBe('**_bold italic_** ');
    });
  });

  describe('mdToTelegramHtml', () => {
    it('should convert standard bold to <b>', () => {
       const md = '**bold**';
       expect(ContentConverter.mdToTelegramHtml(md)).toBe('<b>bold</b>');
    });

    it('should convert italic to <i>', () => {
       const md = '_italic_';
       expect(ContentConverter.mdToTelegramHtml(md)).toBe('<i>italic</i>');
    });

    it('should convert ||spoiler|| to <tg-spoiler>', () => {
       const md = 'This is ||secret||';
       expect(ContentConverter.mdToTelegramHtml(md)).toBe('This is <tg-spoiler>secret</tg-spoiler>');
    });

    it('should handle code blocks with language', () => {
       const md = '```js\nconsole.log(1)\n```';
       expect(ContentConverter.mdToTelegramHtml(md)).toBe('<pre><code class="language-js">console.log(1)</code></pre>');
    });

    it('should escape HTML info', () => {
       const md = '<script>alert(1)</script>';
       // Should be escaped because it looks like HTML but not allowed tag if we treat as text
       // But wait, remark-parse might parse explicit HTML as 'html' node.
       // Our implementation checks specific tags in 'html' node.
       expect(ContentConverter.mdToTelegramHtml(md)).toContain('&lt;script&gt;');
    });

    it('should handle complex nesting', () => {
       const md = '**bold and _italic_**';
       expect(ContentConverter.mdToTelegramHtml(md)).toBe('<b>bold and <i>italic</i></b>');
    });

    it('should handle links', () => {
       const md = '[Google](https://google.com)';
       expect(ContentConverter.mdToTelegramHtml(md)).toBe('<a href="https://google.com">Google</a>');
    });
  });
});
