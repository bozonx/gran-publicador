# n8n-nodes-bozonx-telegram-converter

This is an n8n community node for converting Telegram message entities to HTML, MarkdownV2, and back.

It uses the [@telegraf/entity](https://github.com/telegraf/entity) library for conversions.

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

```bash
npm install n8n-nodes-bozonx-telegram-converter
```

## Features

This node provides four conversion modes:

### 1. Entities → HTML
Convert Telegram text with entities to HTML string.

**Input:**
- `text`: The text content from Telegram message
- `entities`: Array of Telegram MessageEntity objects

**Output:**
```json
{
  "content": "<b>Hello</b> World!",
  "format": "html"
}
```

### 2. Entities → Markdown
Convert Telegram text with entities to standard Markdown with support for non-standard tags like spoilers (`||spoiler||`). 

Unlike MarkdownV2, this mode:
- Does not extensively escape characters like dots, exclamation marks, etc.
- Uses `**bold**`, `_italic_`, `~~strikethrough~~`.
- Preserve spoilers using `||text||` syntax.
- Uses `<u>underline</u>` for underlined text.

**Input:**
- `text`: The text content from Telegram message
- `entities`: Array of Telegram MessageEntity objects

**Output:**
```json
{
  "content": "**Hello** World! ||spoiler||",
  "format": "markdown"
}
```

### 3. Entities → MarkdownV2
Convert Telegram text with entities to MarkdownV2 string.

**Input:**
- `text`: The text content from Telegram message
- `entities`: Array of Telegram MessageEntity objects

**Output:**
```json
{
  "content": "*Hello* World\\!",
  "format": "markdownV2"
}
```

### 3. HTML → Entities
Parse HTML string to Telegram text and entities.

**Input:**
- `inputString`: HTML string like `<b>Hello</b> World!`

**Output:**
```json
{
  "content": {
    "text": "Hello World!",
    "entities": [{"type": "bold", "offset": 0, "length": 5}]
  },
  "format": "entities"
}
```

### 4. Markdown (Legacy) → Entities
Parse Legacy Markdown string to Telegram text and entities.

> **⚠️ IMPORTANT NOTE:**
> This mode **ONLY** supports Telegram's legacy Markdown (V1) syntax.
> It does **NOT** support MarkdownV2 syntax (e.g., `||spoiler||`, `~strikethrough~`, `__underline__` will not be parsed correctly).
>
> If you convert **Entities → MarkdownV2**, you cannot parse the result back using this mode because the syntax versions are different.

#### Workaround for numeric `text_link.url` values

In some cases, the upstream `@telegraf/entity` legacy Markdown parser can produce `text_link` entities where the `url` field becomes a long string of digits (a concatenation of byte values) when parsing links like `[text](https://example.com)`.

This node applies a best-effort workaround in **Markdown (Legacy) → Entities** mode:

- It detects numeric-only `url` values.
- It attempts to decode them back into a UTF-8 string.
- It only replaces the original value if the decoded string is a valid URL with an allowed protocol (`http`, `https`, `tg`, `mailto`).

**Input:**
- `inputString`: Markdown string like `*Hello* World!`

**Output:**
```json
{
  "content": {
    "text": "Hello World!",
    "entities": [{"type": "bold", "offset": 0, "length": 5}]
  },
  "format": "entities"
}
```

## Response Format

All modes return a unified response structure:

| Field | Description |
|-------|-------------|
| `content` | The conversion result - either a formatted string (HTML/MarkdownV2) or an object with `text` and `entities` |
| `format` | The output format: `html`, `markdown`, `markdownV2`, or `entities` |

## Telegram Entity Types

The following Telegram entity types are supported:
- `bold` - Bold text
- `italic` - Italic text
- `underline` - Underlined text
- `strikethrough` - Strikethrough text
- `spoiler` - Spoiler text
- `code` - Inline code
- `pre` - Pre-formatted block
- `text_link` - Hyperlink
- `text_mention` - User mention
- `custom_emoji` - Custom emoji

## Usage Examples

### Convert Telegram webhook message to HTML

When receiving a Telegram message via webhook, you can convert it to HTML:

1. Add a **Telegram Entity Converter** node
2. Set mode to **Entities → HTML**
3. Set `text` to `{{ $json.message.text }}`
4. Set `entities` to `{{ $json.message.entities }}`

### Parse HTML for Telegram API

When you have HTML content and want to send it via Telegram API:

1. Add a **Telegram Entity Converter** node
2. Set mode to **HTML → Entities**
3. Set `inputString` to your HTML content
4. Use `{{ $json.content.text }}` and `{{ $json.content.entities }}` in your Telegram API call

## Options

- **Include Other Input Fields**: When enabled, copies all input data to the output and places the conversion result in a "result" field.

## Development

```bash
# Install dependencies
pnpm install

# Build the node
pnpm build

# Lint the code
pnpm lint
```

## License

MIT

## Author

Ivan K
