# Media Management

## Overview

The `gran-publicador` currently does not have a dedicated internal microservice or module for handling file uploads (images, videos, documents). Verification of the codebase confirms that `Publications` and `Posts` handle media via external URLs or simple string references stored in the database.

## Current Implementation

### Database Schema
In `prisma/schema.prisma`, media is handled as follows:

*   **Publications**: The `Publication` model has a `mediaFiles` field.
    ```prisma
    model Publication {
      ...
      // Array of media file URLs stored as JSON string
      mediaFiles    String     @default("[]") @map("media_files")
      ...
    }
    ```
    This field stores a JSON stringified array of URLs (strings).

### Frontend Handling
The frontend (`PublicationForm.vue` and related components) allows users to input URLs for media. There is no file picker that uploads to the backend.

### Backend Handling
The backend (`PublicationsService`, `PostsService`) blindly creates/updates these fields. It does not validate if the URL is reachable or verify the content type, relying on the client or the publishing service (Telegram/etc.) to handle the actual media retrieval during the publishing phase.

## Recommendations for Future

To support direct file uploads, the following architecture is recommended:

1.  **File Storage Service**:
    *   Integrate an object storage solution (e.g., AWS S3, MinIO, or Google Cloud Storage).
    *   Avoid storing binary data directly in the SQLite/Postgres database.

2.  **Upload Endpoint**:
    *   Create a new module `FilesModule`.
    *   Implement an endpoint `POST /api/v1/files/upload`.
    *   This endpoint should accept `multipart/form-data`.

3.  **Processing**:
    *   Validate file types (MIME types) and sizes.
    *   Generate a unique filename (UUID).
    *   Upload to the storage provider.
    *   Return the public (or signed) URL to the frontend.

4.  **Integration**:
    *   The frontend would upload the file first, get the URL, and then send the URL as part of the `createPublication` or `updatePublication` payload.
