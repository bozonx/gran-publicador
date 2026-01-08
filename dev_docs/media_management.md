# Media Management

## Overview

The `gran-publicador` has a dedicated `MediaModule` for handling media files (images, videos, audio, documents). The system distinguishes between how a file is uploaded and where it is physically stored.

## Core Concepts

### StorageType

The `StorageType` enum represents the physical location of the media file:
*   **`FS`**: Stored on the local filesystem (or a mounted object storage like S3).
*   **`TELEGRAM`**: Stored on Telegram servers (referenced by `file_id`).

### Media Model

Media entries are stored in the `Media` table with the following key fields:
*   `type`: `MediaType` (IMAGE, VIDEO, AUDIO, DOCUMENT)
*   `storageType`: `StorageType` (FS, TELEGRAM)
*   `storagePath`: The path to the file on disk or the Telegram `file_id`.
*   `meta`: JSON string containing metadata (dimensions, duration, etc.).

## Implementation Details

### File Upload Logic

1.  **Direct Upload**: Files are uploaded via `POST /api/v1/media/upload`. They are saved to the filesystem, and a `Media` record with `storageType: FS` is created.
2.  **URL Upload**: When a user provides a URL (`POST /api/v1/media/upload-from-url`), the backend downloads the file, saves it locally, and creates a `Media` record with `storageType: FS`. The original URL is stored in the `meta` field.
3.  **Telegram ID**: Users can provide a Telegram `file_id`. This creates a `Media` record with `storageType: TELEGRAM`. The file remains on Telegram servers and is streamed through the backend when requested.

### Media Streaming

Media is served through `GET /api/v1/media/:id/file`. The backend handles:
*   Streaming local files from disk (`FS`).
*   Proxying streams from Telegram servers (`TELEGRAM`).

### Publications Integration

Publications relate to media through the `PublicationMedia` table, allowing for ordered media attachments. Media can also be grouped using `MediaGroup` for more complex structures (e.g., albums).

## Directory Structure

*   **`src/modules/media/`**: Backend module for media handling.
*   **`ui/app/components/media/`**: Frontend components for media display and management.
*   **`storage/`**: Default local directory for media files (configurable via `DATA_DIR`).
