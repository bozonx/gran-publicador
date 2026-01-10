# n8n-nodes-bozonx-gran-publicador

This package contains n8n nodes for interacting with the Gran Publicador API. Currently, it provides a node for managing publications, with more nodes (Projects, Channels) coming soon.

## Nodes

### Gran Publicador (Publications)

This node allows you to create and manage publications.

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

```bash
npm install n8n-nodes-bozonx-gran-publicador
```

## Features (Publications Node)

### Publication Operations

#### 1. Create
Create a new publication with title, language, status, and content.

**Parameters:**
- `Project ID`: The ID of the project the publication belongs to.
- `Title`: Optional title.
- `Language`: Language code (e.g., `en`, `ru`).
- `Status`: `Draft` or `Ready`.
- `Post Type`: `Post` or `Story`.
- `Additional Fields`:
    - `Content`: Main text content.
    - `Description`: Optional description.
    - `Scheduled At`: Date and time for publication.
    - `Translate To All Languages`: Automatically create translations.
- `Source Texts`: JSON array of source texts `[{"content": "...", "source": "..."}]`.
- `Media URLs`: Comma-separated list of URLs to download and attach.
- `Binary Media`: Option to upload files from n8n binary data.

#### 2. Add Content
Add source texts and media to an existing publication.

**Parameters:**
- `Publication ID`: ID of the existing publication.
- `Source Texts`: JSON array of source texts.
- `Media URLs`: Comma-separated list of URLs.
- `Binary Media`: Option to upload files from n8n binary data.

### System Operations

#### 1. Check Health
Check if the Gran Publicador API is online and responding.

---

*Note: Nodes for Projects and Channels management are currently under development.*

## Credentials

Requires a `baseUrl` and `apiToken` for the Gran Publicador API.

## Development

```bash
# Install dependencies
pnpm install

# Build the node
pnpm build
```

## License

MIT
