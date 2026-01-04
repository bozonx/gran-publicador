# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Changed
- Required `publicationId` for all posts in the database.
- Standalone posts now automatically create a parent "container" publication on the backend.
- Updated `PostForm` and `usePosts` composable to support `publicationId`.
- Refactored `PostsService` to handle mandatory parent relationship.
- Updated database schema and seed data to comply with the new mandatory publication requirement.
