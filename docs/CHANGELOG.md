# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- Redis integration for caching and better performance.
- Global `CacheModule` with Redis store and in-memory fallback for tests.
- Global `RedisModule` for direct access to `ioredis` client.
- Redis service in `docker-compose.yml`.

### Fixed
- LLM config validation error in environments without `FREE_LLM_ROUTER_URL`.
- E2E tests failing due to missing Redis connection and configuration.
- Publication save error (400) caused by `projectId` validation in PATCH requests.

### Changed
- Required `publicationId` for all posts in the database.
- Standalone posts now automatically create a parent "container" publication on the backend.
- Updated `PostForm` and `usePosts` composable to support `publicationId`.
- Refactored `PostsService` to handle mandatory parent relationship.
- Updated database schema and seed data to comply with the new mandatory publication requirement.
