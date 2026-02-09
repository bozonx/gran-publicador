# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Changed
- **LLM Publication Fields Generation**: Reworked AI generation modal to produce structured output.
  - Publication block: title, tags, description, content — generated in the publication's language.
  - Per-channel post blocks: content (only if channel language differs) and tags (with exact channel tag matching).
  - New backend endpoint `POST /llm/generate-publication-fields` with dedicated DTO and system prompt.
  - New `PUBLICATION_FIELDS_SYSTEM_PROMPT` constant for multilingual structured generation.
  - Removed "Regenerate" button from Step 2.
  - Skip button now disabled when no context is available.
  - Channel tags matching: LLM uses channel's predefined tags letter-for-letter when relevant.

- **LLM Prompt Templates**: Major refactor of the template system.
  - Three template sources: System (immutable), Personal (per-user), Project (per-project).
  - Categories are now free-form strings instead of a fixed enum (e.g. "General", "SEO", "Hooks").
  - Hide/unhide mechanism replaces the old override/trash system for both system and custom templates.
  - System templates are immutable; users can hide them per-user or copy to personal/project scope.
  - Copy modal with target selection (personal or any project with `project.update` permission).
  - UI: source tabs (System/Project/Personal), dynamic category filter, show-hidden toggle.
  - Template insertion in LLM modal now always uses `\n\n` separator.
  - New Prisma model `LlmSystemPromptHidden` for per-user hidden state of system templates.
  - New `isHidden` field on `LlmPromptTemplate` for custom template visibility.
  - New API endpoints: `POST system/:id/hide`, `POST system/:id/unhide`, `POST :id/hide`, `POST :id/unhide`, `GET copy-targets`.
  - `includeHidden` query parameter on list endpoints.

### Removed
- `LlmSystemPromptOverride` model and all override-related logic (backend, frontend, DTOs).
- `LlmPromptTemplateCategory` and `LlmSystemPromptOverrideAction` enums from Prisma schema.
- `upsert-system-llm-prompt-override.dto.ts` DTO file.
- Override/restore endpoints from the controller.

### Added
- Posting Snapshot mechanism for posts.
  - New DB fields: `posting_snapshot` (JSONB) and `posting_snapshot_created_at` on `posts` table.
  - `PostSnapshotBuilderService`: builds frozen snapshots (body, media, version) when publication transitions from DRAFT to READY/SCHEDULED.
  - Snapshots are cleared when publication returns to DRAFT; not rebuilt on SCHEDULED→READY.
  - `SocialPostingService.publishSinglePost()` now uses the snapshot as the sole source of truth instead of dynamically loading templates.
  - Platform formatters (`TelegramFormatter`, `DefaultFormatter`) refactored to consume snapshot body and media directly.
  - `PostingSnapshot` interface with versioning (`POSTING_SNAPSHOT_VERSION = 1`).

- Project-level Author Signatures with language variants.
  - New DB tables: `project_author_signatures`, `project_author_signature_variants`.
  - Backend module: `author-signatures` rewritten for project-level CRUD with variant management.
  - API endpoints: `GET/POST /projects/:projectId/author-signatures`, `PATCH/DELETE /author-signatures/:id`, `PUT/DELETE /author-signatures/:id/variants/:language`.
  - Signature resolution at publication level: when creating posts, the backend resolves the correct language variant per channel, with per-channel override support.
  - UI: `AuthorSignatureManager` moved to project settings with multi-language variant editing.
  - UI: Signature selector added to publication creation form.
  - Warnings for missing language variants displayed in project settings.

### Removed
- Channel-level author signatures (`AuthorSignature` model tied to `channelId`).
- `isDefault` signature logic and auto-selection in `PostsService.create`.
- `AuthorSignatureSelector` component from `PostEditBlock` (replaced with plain text field).
- Preset signatures (`preset-signatures.constants.ts` backend + `preset-signatures.ts` UI).
- Author signature management section from channel settings page.

### Added
- Project-level Publication Templates: templates are now defined at the project level instead of per-channel.
  - New DB table: `ProjectTemplate` with `name`, `postType`, `isDefault`, `order`, `template` (JSON blocks).
  - Backend module: `project-templates` with service, controller, DTOs.
  - API endpoints: `GET/POST /projects/:id/templates`, `GET/PATCH/DELETE /projects/:id/templates/:templateId`, `PATCH /projects/:id/templates/reorder`.
  - Channel templates are now "variations" — lightweight overrides (before/after/content/tagCase) linked to a project template via `projectTemplateId`.
  - UI: `ProjectTemplatesEditor` component in project settings, rewritten `ChannelTemplatesEditor` for variations.
  - Composable: `useProjectTemplates` for frontend API integration.
  - `SocialPostingBodyFormatter` (backend + UI) rewritten to merge project template blocks with channel variation overrides.
  - Deleting a project template cascades to all linked channel variations.

### Removed
- Footer entities (`ChannelFooter`, `footerId`) removed from templates, posts, DTOs, and UI.
  - Footers are now plain text content in the `footer` block of project templates.
  - `ChannelFootersManager` component removed from channel settings.
  - `footerId` removed from `Post` model, `CreatePostDto`, `UpdatePostDto`, and `PostEditBlock`.
- Channel-only templates (legacy `ChannelPostTemplate` with full block definitions) replaced by project template variations.

### Added
- Publication Relations: new generic linking system replacing old "Link as Translation" feature.
  - Two relation types: `SERIES` (sequential parts) and `LOCALIZATION` (multi-language versions).
  - New DB tables: `publication_relation_groups`, `publication_relation_items`.
  - Backend module: `publication-relations` with service, controller, DTOs.
  - API endpoints: `GET/POST /publications/:id/relations/*`, `PATCH /publications/relation-groups/:groupId/reorder`.
  - UI: Relations indicator in publication edit page metadata grid, `PublicationRelationsModal` for managing links.
  - Composable: `usePublicationRelations` for frontend API integration.
  - Moving a publication to another project now breaks all relation links.
  - Constraints: same `projectId`, same `postType`, unique language per `LOCALIZATION` group, one `SERIES` group per publication.

### Removed
- Old "Link as Translation" functionality (`translationGroupId`, `linkToPublicationId`) from schema, DTOs, service logic, and UI.

- Redis integration for caching and better performance.
- Global `CacheModule` with Redis store and in-memory fallback for tests.
- Global `RedisModule` for direct access to `ioredis` client.
- Redis service in `docker-compose.yml`.
- Media Storage microservice integration for file handling.
- Speech-To-Text (STT) support via external gateway.
- Reprocessing capabilities for existing media files.
- Media endpoint to replace an existing FS media file while keeping the same Media ID.
- Content Library tabs: folders and saved views with per-scope ordering.

### Fixed
- Autosave: fixed `SaveStatusIndicator` `v-if`/`v-else-if` chain rendering multiple status blocks simultaneously.
- Autosave: moved `isEqual` check inside the save queue to prevent duplicate API requests on rapid changes.
- Autosave: reference change (tab switch) now shows error toast if saving old dirty data fails, instead of silently losing changes.
- Autosave: fixed `@blur` on `PublicationNotesBlock` textarea closing edit mode when clicking Retry button inside `SaveStatusIndicator`.
- Autosave: added `enableNavigationGuards` option to prevent duplicate navigation guards when `useFormDirtyState` is also active.
- Autosave: `MediaGallery` saveFn no longer reports failure when media metadata saved but spoiler link update fails (partial save).
- TipTap editor: use native `content` + `contentType: 'markdown'` instead of `onCreate` workaround for initial content.
- TipTap editor: STT `insertContent` now uses `contentType: 'markdown'` for consistent markdown-first approach.
- TipTap editor: fixed extensions watchers losing changes by using `buildExtensions()` factory function.
- TipTap editor: BubbleMenu for links now uses `shouldShow` prop instead of `v-show` for correct positioning.
- TipTap editor: source mode textarea changed from `v-if` to `v-show` to avoid re-creation on toggle.
- TipTap editor: default placeholder now uses i18n.
- TipTap editor: removed duplicate `BubbleMenuExtension` from extensions array (already provided by `<BubbleMenu>` component).
- TipTap editor: replaced deprecated `tippyOptions` with Floating UI `options` in BubbleMenu components.
- TipTap editor: replaced undocumented `extensionManager.configure()` hacks with proper `editor.setOptions()` for dynamic placeholder/characterCount updates.
- TipTap editor: removed redundant manual `editor.destroy()` in `onBeforeUnmount` (handled automatically by `useEditor`).
- Removed unused `@tiptap/extension-bubble-menu` and `@tiptap/extension-floating-menu` dependencies.
- Content Library: integrated TipTap rich text editor into `ContentBlockEditor` replacing plain `UTextarea`.
- Prisma generate error in GitHub Actions caused by missing `DATABASE_URL` and uncompiled config files.
- LLM config validation error in environments without `FREE_LLM_ROUTER_URL`.
- E2E tests failing due to missing Redis connection and configuration.
- Publication save error (400) caused by `projectId` validation in PATCH requests.
- Incorrect Postgres and Redis versions in Docker configuration.
- News notification scheduler duplicate and missing news items due to incorrect watermark logic and missing pagination support.


### Changed
- TipTap editor: removed `Underline` extension (not compatible with standard Markdown; raw `<u>` tags from Telegram preserved as-is).
- TipTap editor: removed `mergeCells`/`splitCell` table buttons (not representable in Markdown format).
- Unified Markdown parser: migrated from `markdown-it` to `marked` across the project (same parser used by `@tiptap/markdown`).
- Removed `@tiptap/extension-underline`, `markdown-it`, `@types/markdown-it` dependencies; added `marked` as direct dependency.
- Content Library schema refactor: replaced `ContentText` and `ContentItemMedia` with `ContentBlock` (optional `text`) and `ContentBlockMedia`.
- Content Library API updated to manage blocks and block media via `/content-library/items/:id/blocks` and `/content-library/items/:id/blocks/:blockId/media`.
- Required `publicationId` for all posts in the database.
- Standalone posts now automatically create a parent "container" publication on the backend.
- Updated `PostForm` and `usePosts` composable to support `publicationId`.
- Refactored `PostsService` to handle mandatory parent relationship.
- Updated database schema and seed data to comply with the new mandatory publication requirement.
- Refactored `MediaService` to use `undici` for better streaming and modern configuration patterns.
- Moved generated Prisma client out of version control.
- Cleaned up debug logs and temporary scripts.
