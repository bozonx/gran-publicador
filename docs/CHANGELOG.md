# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
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
