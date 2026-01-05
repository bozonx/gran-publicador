# Error Propagation Implementation Check

## Objective
Implement and verify full error propagation across all levels: from posts to channels/publications, and from channels/publications to projects. Ensure visual visibility of problems on entity pages, lists, and cards.

## Changes

### 1. Backend: Aggregation Logic (`ProjectsService`)
-   **`findOne`**: Updated to fetch `failedPostsCount` for each channel within a project. Added calculation for project-level `problemPublicationsCount` (publications with `FAILED` or `PARTIAL` status) and total `failedPostsCount`.
-   **`findAllForUser`**: Updated to include `problemPublicationsCount` for projects in the list view using efficient `groupBy` query.

### 2. Frontend: UI Visibility
-   **Project Detail Page (`projects/[id]/index.vue`)**:
    -   Updated `projectProblems` computed property to include problematic publications in the `CommonProblemBanner`.
    -   Banner now accurately reflects critical channel issues and publication failures.
-   **Project List & Cards (`ProjectListItem.vue`, `ProjectCard.vue`)**:
    -   Added display of `problemPublicationsCount` with matching icons and tooltips.
    -   Unified display of `failedPostsCount` across list and card views.
-   **Channel Page (`channels/[id]/index.vue`)**:
    -   Confirmed banner visibility for failed posts using the corrected backend data.
-   **Types**: Updated `ProjectWithRole` interface in Pinia store to include `problemPublicationsCount`.

### 3. Localization
-   Verified and used existing translation keys in `ru-RU.json`:
    -   `problems.project.problemPublications`
    -   `criticalChannels`
    -   `warningChannels`
    -   `staleChannels`

## Verification Results
-   [x] Problems from posts are visible on the Channel page banner.
-   [x] Channel problems (failed posts, no credentials) are visible on the Project page.
-   [x] Publication problems (`FAILED`/`PARTIAL` status) are visible on the Project page.
-   [x] Problems are summarized in Project cards and list items.
-   [x] Individual post problems are visible on the Publication page.

The implementation ensures that no critical error is hidden from the user, regardless of which level they are viewing.
