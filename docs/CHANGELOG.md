# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Video Editor: streaming export upload**: exported video is now streamed directly to the server without buffering the result as a `Blob`/`File` in browser memory.
  - New endpoint `POST /media/upload-stream` accepts raw body stream with metadata headers (`x-filename`, `x-mime-type`, `x-file-size`, `x-project-id`, `x-optimize`).
  - `useMedia.uploadMediaStream()` composable function for streaming uploads via `fetch`.
  - Fastify content-type parsers added for `video/*` and `application/octet-stream` to pass streams through without buffering.
- **Gran Video Editor: project settings persistence**
  - Added Project tab in the left panel with project-level Export and Proxy settings.
  - Added persistent settings file `.gran/project.settings.json` per project; settings are loaded on project open and auto-saved on change.
  - Timeline export modal now uses project settings as defaults for resolution and encoding and allows overriding export resolution per export run.

### Changed
- **Posts: platformOptions are now namespaced by platform**: UI stores platform-specific options under `platformOptions.<platform>` (e.g. `platformOptions.telegram.*`). Backend social-posting formatter reads platform options only from the namespaced object.

### Added
- **Telegram post option: caption above media**: added support for Telegram Bot API option `show_caption_above_media` (sent via `options` object to the social-media microservice).

### Changed
- **Content Library: removed Content Blocks**: Content items now store `text`, `meta` and `media` directly on `ContentItem`.
  - Removed `ContentBlock` / `ContentBlockMedia` models and all related endpoints.
  - Content merge now concatenates texts with `\n\n---\n\n` and merges media links.
  - List endpoint query flag renamed from `includeBlocks` to `includeMedia`.

### Changed
- **Schedulers execution model**: removed all internal interval/cron background launches for publications, news notifications, and notifications cleanup.
  - Added synchronous manual run endpoints with execution results:
    - `POST /system/schedulers/publications/run`
    - `POST /system/schedulers/news/run`
    - `POST /system/schedulers/maintenance/run`
  - System endpoints now support two auth modes: `X-System-Token` (with local network restriction when enabled) **or** authenticated app user with `isAdmin=true`.
  - Removed obsolete env vars: `SCHEDULER_INTERVAL_SECONDS`, `NEWS_NOTIFICATION_INTERVAL_MINUTES`.
  - Admin UI tab **Configuration** replaced by **Maintenance** with manual run buttons for publications, news notifications, and full maintenance.
- **Content Library groups API contract**:
  - Removed direct unlink endpoint `DELETE /content-library/items/:id/groups/:groupId`.
  - Items can no longer be detached from groups directly; use move operations instead.
  - Group deletion now explicitly moves primary group assignments to root (`groupId = null`) and removes relations to the deleted group in a transaction.

### Fixed
- **Content Library groups UX**:
  - Groups tree sidebar is now rendered only when active tab type is `GROUP`.
  - Group node menu now hides delete action for root groups (root group remains non-deletable in backend and UI).
  - Group deletion now navigates to parent group both from tree actions and top toolbar actions.
  - Group labels now display direct items count (non-archived) in both top tabs and sidebar tree.
- **Tags domains separation**:
  - Content Library tag suggestions and search are now isolated from Publications/Posts tags.
  - Publications/Posts tag suggestions and search are now isolated from Content Library tags.
  - Content Library group tag suggestions/search are scoped to the active root group tab.
- **Content Library upload target group consistency**:
  - Drag-and-drop and upload button flows now lock target `groupId` at upload start to avoid accidental reassignment when active tab changes during multi-file upload.
- **News notifications duplicate delivery**: replaced query-level watermarking with per-user per-query state (`news_notification_user_states`) so already delivered news do not reappear in later notifications for the same user.
- **News queries access control**: added explicit project access checks for list/create/update/reorder/delete operations in `NewsQueriesService`.
- **News query creation bug**: `isNotificationEnabled` is now persisted to the dedicated DB column instead of leaking into JSON settings.
- **Notification channel preferences**: internal notifications now respect `preferences.notifications.<TYPE>.internal` and are skipped when disabled.
- **Media Storage integration: raw stream upload API** — switched backend upload proxy from multipart/form-data to raw stream (`POST /files`) with header-based params (`x-filename`, `x-metadata`, `x-optimize`, `x-file-size` when provided), removed deprecated `/confirm` call, and aligned metadata mapping with the new response shape (`optimization.params`, `original.*`, `status`, `exif`).
- **Media upload forms** — frontend now sends `fileSize` in multipart fields for upload/replace so backend can forward exact byte size to Media Storage (`x-file-size`) without buffering the whole file.
- **Tags: case-sensitive filtering** in ContentItem search — switched from `name` to `normalizedName` with `.toLowerCase()` for both direct tag filter and search-by-tag.
- **Tags: inconsistent API responses** — Publications API now consistently returns `tags: string[]` alongside `tagObjects` in all endpoints (create, findAll, findAllForUser, findOne, update, copyToProject).
- **Tags: missing Post DTO validation** — Added `@ArrayMaxSize` and `@MaxLength` validators to `CreatePostDto` and `UpdatePostDto` tags field, matching Publication and ContentItem DTOs.
- **Tags: migration script** — Fixed `migrate-tags.ts` to use correct unique index names (`projectId_normalizedName`, `userId_normalizedName`) and include `normalizedName` in create data.
- **Tags: PostEditBlock.vue type safety** — Changed `tags: null` to `tags: []` for proper TypeScript typing when clearing post tags.
- **Tags: social posting formatter** — Removed unnecessary string↔array round-trip in `DefaultFormatter`; tag names are now formatted directly as `#tag` array.
- **Tags: SearchTagsQueryDto** — Added `@Type(() => Number)`, `@IsInt`, `@Min(1)`, `@Max(50)` validation for `limit` parameter.
- **Tags: duplicated scope validation** — Removed redundant scope check from `TagsService.search()` (already validated in controller).
- **Tag input (CommonInputTags)**: Fixed multiple UX and reliability issues.
  - Added race-safe async suggestions (request invalidation + abort) to prevent stale search results.
  - Enforced strict scope handling for suggestions (`projectId` xor `userId`) to avoid ambiguous behavior.
  - Made suggestion list deduplication case-insensitive.
  - Added robust clipboard copy fallback with user-facing success/error toasts.
  - Aligned tag normalization with a client-side limit of 50 tags (matching backend behavior).
- **LLM Quick Generator Modal button text**: Fixed button showing "Apply to selection" instead of "Replace content" when no text is selected in the editor. Added `isWholeDocument` flag to `useEditorTextActions` and `isFullReplace` prop to `LlmQuickGeneratorModal`.
- **Editor formatting BubbleMenu**: Restored formatting bubble menu (bold, italic, strike, code, link, AI, translate) that appears when text is selected in the TiptapEditor.
- **STT in LLM Chat (LlmGeneratorModal)**: Fixed critical bug where two independent `useStt()` instances and a separate `useVoiceRecorder()` were created, causing audio chunks to never be streamed via WebSocket. Consolidated to a single `useStt()` instance with proper `start`/`stop`/`cancel` flow.
- **STT in Editor (TiptapEditor)**: Fixed `sttSelection` not being cleared on STT errors, leaving the editor in an inconsistent state when connection to STT service fails.
- **STT composable (useStt)**: Fixed socket event listener leaks — `detachSocketListeners` was not removing the `'error'` handler; `waitForTranscription` cleanup was not removing its own `transcription-error` and `disconnect` handlers.
- **STT composable (useStt)**: Fixed broken socket persisting in store after connection failure — `ensureConnected` now properly disconnects and clears the store socket on error so subsequent attempts create a fresh connection.
- **Telegram Bot STT**: Fixed voice message transcription always receiving `undefined` language — user's content language is now properly passed through `createContentItemFromMessage` and `addMediaGroupMessageToContentBlock` to `transcribeVoice`.

### Changed
- **Content Library terminology/API contract**:
  - UI/API now uses **Group** terminology (`GROUP`, `groupId`) instead of folder wording.
  - Backend/Prisma model also migrated to `GROUP` / `groupId` naming.
- **Content Library groups workflow**:
  - Added quick subgroup creation from active `GROUP` tab with immediate navigation into the new subgroup.
  - Added bulk **To group** action (available only in `GROUP` tabs) with context-scoped tree selection.
  - Added bulk modes: `MOVE_TO_GROUP` (detach only from current active group) and `LINK_TO_GROUP` (add extra relation).
  - Added inline subgroup creation inside the **To group** modal (always under current active group).
- **Content Library toolbar**:
  - Removed non-functional view mode toggle (library remains card-only).
  - Added informational tooltip explaining group behavior and safe deletion semantics (deleting a group does not delete content items).
- **Content Library tab config persistence**:
  - For `GROUP` tabs, only sorting is persisted.
  - For `SAVED_VIEW` tabs, sorting + search + tag filters are persisted.
- **Media optimization policy**: moved image optimization control for `format`, `maxDimension`, `effort`, `quality`, `chromaSubsampling`, `lossless`, and global enable/disable to backend env configuration.
  - New env vars: `MEDIA_IMAGE_OPTIMIZATION_ENABLED`, `MEDIA_IMAGE_OPTIMIZATION_FORMAT`, `MEDIA_IMAGE_OPTIMIZATION_MAX_DIMENSION`, `MEDIA_IMAGE_OPTIMIZATION_EFFORT`, `MEDIA_IMAGE_OPTIMIZATION_QUALITY`, `MEDIA_IMAGE_OPTIMIZATION_CHROMA_SUBSAMPLING`, `MEDIA_IMAGE_OPTIMIZATION_LOSSLESS`.
  - Backend now forces those values from env when optimization is enabled and applies the same policy for upload stream + upload-from-url.
  - Removed optimization presets from UI and removed env-driven controls from project/upload optimization forms.
- **LLM Publication Fields Generation**: Added per-channel content shortening support.
  - Optional `channels[].maxContentLength` is now forwarded to the LLM instruction block.
  - LLM may return `posts[].content` as a per-channel override only when `publication.content` exceeds the channel limit.
  - UI can insert per-channel post content using the generated override (fallbacks to `publication.content`).
- **Social media platform IDs**: Migrated platform identifiers to lowercase across the whole project.
  - Platforms are now stored and handled as `telegram`, `vk`, `site` (and future platforms in lowercase).
  - Requires database migration for Prisma `SocialMedia` enum.
  - Requires regenerating Prisma client after schema update.
- **Project Templates redesign**: Unified template management with tabbed modal editor.
  - Removed channel template variations from channel settings — now managed from project template editor.
  - Added `language` field to `ProjectTemplate` model to filter channels by language.
  - Create-and-open pattern: clicking "Add Template" immediately creates a template and opens the editor.
  - Autosave for both project template settings and channel overrides.
  - Modal tabs: Project tab (block ordering, enable/disable) + per-channel tabs (text overrides).
  - Channel exclusion: channels can be explicitly excluded from a template.
  - "Done" button replaces "Cancel"/"Save" buttons.

- **Single-language publication model**: Publications now enforce strict single-language policy.
  - Publication language is immutable after creation (`language` removed from `UpdatePublicationDto`).
  - Backend validates that all channels match the publication language when creating posts (`createPostsFromPublication`) and during publication creation with `channelIds`.
  - UI strictly filters channels by publication language in `CreatePublicationModal`, `PublicationChannelSelector`, `PublicationForm`, and `ChannelQuickAccessBlock`.
  - Removed language change modal from publication edit page.
  - LLM generation simplified: removed per-channel content translation (`generateContent`), kept only per-channel tag generation.
  - Removed language mismatch warnings and translate button from `PostEditBlock` (translation will be added later as a separate feature).
  - Existing mixed-language publications are not migrated; new mixed-language additions are prevented.

### Fixed
- **Frontend Unit Tests**: Fixed broken unit tests for `SocialPostingBodyFormatter` after the project templates redesign.
- **TiptapEditor Link**: Fixed multiple issues with the link function.
  - Added `defaultProtocol: 'https'` so URLs without protocol are handled correctly.
  - Fixed BubbleMenu flicker: link menu no longer re-opens on every cursor move within a link.
  - `setLink()` now validates that text is selected or cursor is inside an existing link before opening.
  - Added `normalizeUrl()` with XSS protection (blocks `javascript:`, `data:`, `vbscript:` protocols).
  - Auto-prepends `https://` to URLs without a protocol; allows `mailto:` and `tel:`.

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
