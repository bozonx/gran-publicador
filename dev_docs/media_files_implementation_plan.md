# Media Files Implementation Plan

## Overview

Implementation of comprehensive media files support for publications with multiple source types (Telegram, File System, URL), media grouping capabilities (similar to Telegram media groups), and full CRUD operations through API and UI.

## Architecture Decisions

### Media Groups
- **Decision**: Use separate `MediaGroup` table with junction table `MediaGroupItem`
- **Rationale**: Provides flexibility for reusing media files in different groups, easier metadata management, and cleaner separation of concerns

### Legacy Data
- **Decision**: Remove legacy `mediaFiles` field completely, no migration
- **Rationale**: Clean slate approach, simpler implementation, no backward compatibility burden

### Media Storage
- **Decision**: `MEDIA_DIR` environment variable, defaults to `${DATA_DIR}/media`
- **Rationale**: Consistent with existing `DATA_DIR` pattern, keeps media files organized alongside database

### Source Types
- **Telegram**: Store Telegram `file_id` for files uploaded to Telegram
- **FS (File System)**: Store relative path within `MEDIA_DIR` for uploaded files
- **URL**: Store external URL for remote media files (new feature)

## Database Schema

### New Tables

#### `media`
```sql
CREATE TABLE "media" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "type" TEXT NOT NULL,           -- 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT'
  "src_type" TEXT NOT NULL,       -- 'TELEGRAM' | 'FS' | 'URL'
  "src" TEXT NOT NULL,            -- file_id, path, or URL
  "filename" TEXT NOT NULL,
  "mime_type" TEXT,
  "size_bytes" INTEGER,
  "meta" TEXT NOT NULL DEFAULT '{}', -- JSON: {width, height, duration, thumbnail, ...}
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "idx_media_type" ON "media"("type");
CREATE INDEX "idx_media_src_type" ON "media"("src_type");
```

#### `media_groups`
```sql
CREATE TABLE "media_groups" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT,
  "description" TEXT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

#### `media_group_items`
```sql
CREATE TABLE "media_group_items" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "media_group_id" TEXT NOT NULL,
  "media_id" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY ("media_group_id") REFERENCES "media_groups"("id") ON DELETE CASCADE,
  FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_media_group_items_group" ON "media_group_items"("media_group_id");
CREATE INDEX "idx_media_group_items_media" ON "media_group_items"("media_id");
CREATE UNIQUE INDEX "idx_media_group_items_unique" ON "media_group_items"("media_group_id", "media_id");
```

#### `publication_media`
```sql
CREATE TABLE "publication_media" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publication_id" TEXT NOT NULL,
  "media_id" TEXT,
  "media_group_id" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("publication_id") REFERENCES "publications"("id") ON DELETE CASCADE,
  FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE SET NULL,
  FOREIGN KEY ("media_group_id") REFERENCES "media_groups"("id") ON DELETE SET NULL,
  CHECK (("media_id" IS NOT NULL AND "media_group_id" IS NULL) OR ("media_id" IS NULL AND "media_group_id" IS NOT NULL))
);

CREATE INDEX "idx_publication_media_publication" ON "publication_media"("publication_id");
CREATE INDEX "idx_publication_media_media" ON "publication_media"("media_id");
CREATE INDEX "idx_publication_media_group" ON "publication_media"("media_group_id");
```

### Schema Changes

#### Remove from `publications` table
```sql
-- Remove legacy field
ALTER TABLE "publications" DROP COLUMN "media_files";
```

## Implementation Steps

### Phase 1: Database Layer

**Files to create:**
- `prisma/migrations/YYYYMMDDHHMMSS_add_media_support/migration.sql`

**Files to modify:**
- `prisma/schema.prisma` - Add Media, MediaGroup, MediaGroupItem, PublicationMedia models
- `prisma/schema.prisma` - Remove `mediaFiles` field from Publication model
- `prisma/schema.prisma` - Add enums: MediaType, MediaSourceType

**Verification:**
```bash
pnpm prisma:migrate:dev
pnpm prisma:generate
```

### Phase 2: Backend - Media Module

**Files to create:**
- `src/modules/media/media.module.ts`
- `src/modules/media/media.service.ts`
- `src/modules/media/media.controller.ts`
- `src/modules/media/dto/create-media.dto.ts`
- `src/modules/media/dto/update-media.dto.ts`
- `src/modules/media/dto/create-media-group.dto.ts`
- `src/modules/media/dto/attach-media.dto.ts`
- `src/modules/media/dto/index.ts`

**Key functionality:**
- Media CRUD operations
- Media group management
- File upload handling (for FS source type)
- URL validation (for URL source type)
- Telegram file_id validation (for Telegram source type)

**API Endpoints:**
```
POST   /api/media              - Create media record
POST   /api/media/upload       - Upload file (returns media record)
GET    /api/media/:id          - Get media by ID
PATCH  /api/media/:id          - Update media metadata
DELETE /api/media/:id          - Delete media

POST   /api/media/groups       - Create media group
GET    /api/media/groups/:id   - Get media group with items
PATCH  /api/media/groups/:id   - Update media group
DELETE /api/media/groups/:id   - Delete media group
```

### Phase 3: Backend - Publications Module Updates

**Files to modify:**
- `src/modules/publications/dto/create-publication.dto.ts` - Remove `mediaFiles`, add media support
- `src/modules/publications/dto/update-publication.dto.ts` - Remove `mediaFiles`, add media support
- `src/modules/publications/publications.service.ts` - Update create/update/findOne methods
- `src/modules/publications/publications.module.ts` - Import MediaModule

**Key changes:**
- Remove all references to `mediaFiles` field
- Add media/mediaGroups handling in create/update operations
- Include media relations in findOne/findAll queries
- Support for attaching existing media or creating new media inline

### Phase 4: Configuration

**Files to modify:**
- `.env.production.example` - Add MEDIA_DIR variable
- `.env.development.example` - Add MEDIA_DIR variable

**Files to create:**
- `src/config/media.config.ts` - Media configuration helper

**Environment variables:**
```bash
# Media storage directory (defaults to ${DATA_DIR}/media)
MEDIA_DIR="${DATA_DIR}/media"

# Media upload limits
MEDIA_MAX_FILE_SIZE=52428800  # 50MB
MEDIA_ALLOWED_TYPES="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,audio/mpeg,audio/ogg,application/pdf"
```

### Phase 5: Frontend - Composables

**Files to create:**
- `ui/app/composables/useMedia.ts` - Media API client composable

**Key functionality:**
- `createMedia()` - Create media record
- `uploadFile()` - Upload file to server
- `createMediaGroup()` - Create media group
- `fetchMedia()` - Get media by ID
- `deleteMedia()` - Delete media
- `attachMediaToPublication()` - Attach media to publication

### Phase 6: Frontend - Components

**Files to create:**
- `ui/app/components/media/MediaUploader.vue` - Main media upload/management component
- `ui/app/components/media/MediaPreview.vue` - Media preview component
- `ui/app/components/media/MediaGroupEditor.vue` - Media group editor
- `ui/app/components/media/MediaItem.vue` - Single media item display
- `ui/app/components/media/MediaSourceSelector.vue` - Source type selector (FS/Telegram/URL)

**Files to modify:**
- `ui/app/components/forms/PublicationForm.vue` - Add media section

**Features:**
- Drag & drop file upload
- Multiple source type support (Upload, Telegram file_id, URL)
- Media preview (images, videos, audio, documents)
- Media grouping with drag & drop ordering
- Media metadata display (size, dimensions, duration)
- Delete/reorder media items

### Phase 7: Testing

**Files to create:**
- `test/unit/media.service.spec.ts` - Media service unit tests
- `test/e2e/media.e2e-spec.ts` - Media API E2E tests

**Files to modify:**
- `test/unit/publications.service.spec.ts` - Update tests to remove mediaFiles references
- `test/e2e/publications.e2e-spec.ts` - Update tests to use new media structure

**Test coverage:**
- Media CRUD operations
- Media group operations
- File upload validation
- URL validation
- Telegram file_id handling
- Publication with media creation
- Media deletion cascade behavior

## Data Flow

### Creating Publication with Media

```
User uploads files in UI
  ↓
Files sent to POST /api/media/upload
  ↓
Server saves files to MEDIA_DIR
  ↓
Media records created in DB (type=IMAGE, srcType=FS, src=relative/path.jpg)
  ↓
User creates media group (optional)
  ↓
User submits publication form
  ↓
POST /api/publications with mediaIds/mediaGroupIds
  ↓
PublicationMedia records created linking publication to media
  ↓
Publication saved with media relations
```

### Adding Media from URL

```
User enters URL in MediaUploader
  ↓
POST /api/media with {type, srcType: 'URL', src: 'https://...', filename}
  ↓
Server validates URL (optional: fetch metadata)
  ↓
Media record created (no file stored locally)
  ↓
Media attached to publication
```

### Adding Media from Telegram

```
User enters Telegram file_id
  ↓
POST /api/media with {type, srcType: 'TELEGRAM', src: 'file_id', filename}
  ↓
Media record created
  ↓
Media attached to publication
  ↓
When publishing to Telegram, file_id is used directly
```

## File Storage Structure

```
${DATA_DIR}/
├── gran-publicador.db
└── media/
    ├── images/
    │   ├── 2026/01/
    │   │   ├── uuid-1.jpg
    │   │   └── uuid-2.png
    ├── videos/
    │   └── 2026/01/
    │       └── uuid-3.mp4
    ├── audio/
    └── documents/
```

## Security Considerations

1. **File Upload Validation**
   - Validate MIME types against allowed list
   - Check file size limits
   - Sanitize filenames
   - Prevent path traversal attacks

2. **URL Validation**
   - Validate URL format
   - Optional: Check URL accessibility
   - Prevent SSRF attacks (block internal IPs)

3. **Access Control**
   - Verify user has access to project before accessing media
   - Implement media permissions based on publication permissions
   - Secure file serving (no directory listing)

4. **Storage Security**
   - Store files outside web root
   - Serve files through controlled endpoint
   - Implement rate limiting for uploads

## Performance Optimizations

1. **Image Processing**
   - Generate thumbnails on upload
   - Create multiple sizes for responsive images
   - Convert to WebP for better compression

2. **Caching**
   - Cache media metadata
   - Use ETags for browser caching
   - CDN integration for static files

3. **Database**
   - Proper indexing on foreign keys
   - Eager loading of media relations
   - Pagination for media lists

## Future Enhancements

1. **Media Library**
   - Reusable media across publications
   - Media search and filtering
   - Bulk media operations

2. **Advanced Processing**
   - Image cropping/editing
   - Video transcoding
   - Audio normalization

3. **External Storage**
   - S3/MinIO integration
   - CDN integration
   - Cloud storage providers

4. **Analytics**
   - Media usage statistics
   - Storage usage monitoring
   - Popular media tracking

## Rollout Plan

1. **Development** (Week 1)
   - Database schema and migration
   - Backend Media module
   - Publications module updates

2. **Testing** (Week 1-2)
   - Unit tests
   - E2E tests
   - Manual testing

3. **Frontend** (Week 2)
   - Media components
   - Publication form updates
   - UI/UX polish

4. **Integration** (Week 2-3)
   - Full flow testing
   - Performance testing
   - Security audit

5. **Deployment** (Week 3)
   - Production migration
   - Monitoring setup
   - Documentation update

## Success Metrics

- ✅ All media source types working (FS, Telegram, URL)
- ✅ Media groups can be created and managed
- ✅ Publications can have multiple media items
- ✅ File upload works with validation
- ✅ Media preview works for all types
- ✅ All tests passing (unit + E2E)
- ✅ No performance degradation
- ✅ Clean removal of legacy mediaFiles field
