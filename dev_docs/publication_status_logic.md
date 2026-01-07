# Publication Status Logic Implementation Plan

## Overview

Refactor publication status management to separate user-selectable statuses (DRAFT, READY) from system-managed statuses (SCHEDULED, PROCESSING, PUBLISHED, PARTIAL, FAILED, EXPIRED).

## Business Rules

### User-Selectable Statuses
- **DRAFT**: Draft publication, may be incomplete
- **READY**: Complete publication, ready but not scheduled

### System-Managed Statuses
- **SCHEDULED**: Automatically set when `scheduledAt` is set
- **PROCESSING**: Set by publishing service during processing
- **PUBLISHED**: All posts successfully published
- **PARTIAL**: Some posts published, some failed
- **FAILED**: All posts failed to publish
- **EXPIRED**: Publication missed the publishing window

## Status Change Rules

### Rule 1: Change Status to DRAFT
**User Action**: Sets `publication.status = DRAFT`

**Result**:
- `publication.scheduledAt` = `null`
- For all posts:
  - `post.status` = `PENDING`
  - `post.scheduledAt` = `null`
  - `post.errorMessage` = `null`

### Rule 2: Change Status to READY
**User Action**: Sets `publication.status = READY`

**Validation**:
- ✅ `publication.content` must be filled

**Result**:
- `publication.scheduledAt` = `null`
- For all posts:
  - `post.status` = `PENDING`
  - `post.scheduledAt` = `null`
  - `post.errorMessage` = `null`

### Rule 3: Set/Change Publication scheduledAt
**User Action**: Sets or changes `publication.scheduledAt`

**Validation**:
- ✅ `publication.content` must be filled

**Result**:
- `publication.status` = `SCHEDULED` (automatic)
- For posts **without** their own `scheduledAt`:
  - `post.status` = `PENDING`
  - `post.errorMessage` = `null`
- Posts **with** their own `scheduledAt` remain unchanged

### Rule 4: Set/Change Post scheduledAt
**User Action**: Sets or changes `post.scheduledAt`

**Validation**:
- ✅ `publication.scheduledAt` must be set
- ❌ If publication has no `scheduledAt` → validation error

**Result**:
- `post.status` = `PENDING`
- `post.errorMessage` = `null`
- `publication.status` remains `SCHEDULED`

### Rule 5: Remove Post scheduledAt
**User Action**: Removes `post.scheduledAt` (sets to `null`)

**Result**:
- `post.scheduledAt` = `null`
- Post inherits `scheduledAt` from publication (logically, not in DB)
- `post.status` remains unchanged
- `post.errorMessage` = `null`

### Rule 6: System Status Changes
**System Action**: Changes status to PROCESSING, PUBLISHED, PARTIAL, FAILED, EXPIRED

**Result**:
- Post statuses and times **NOT changed**
- Managed only by publishing service

## Implementation Changes

### Backend

#### 1. DTOs Validation

**Files**:
- `src/modules/publications/dto/create-publication.dto.ts`
- `src/modules/publications/dto/update-publication.dto.ts`

**Changes**:
- Add custom validator `@IsUserStatus()` for `status` field (allow only DRAFT, READY)
- Add validation: if `status = READY`, then `content` must be filled
- Add validation: if `scheduledAt` is set, then `content` must be filled

**New Validator**:
- Create `src/common/validators/is-user-status.validator.ts`

#### 2. Publications Service

**File**: `src/modules/publications/publications.service.ts`

**Method `update`**:

```typescript
// When status changes to DRAFT or READY
if (data.status === PublicationStatus.DRAFT || data.status === PublicationStatus.READY) {
  data.scheduledAt = null;
  
  await this.prisma.post.updateMany({
    where: { publicationId: id },
    data: {
      status: PostStatus.PENDING,
      scheduledAt: null,
      errorMessage: null
    }
  });
}

// When scheduledAt is set
if (data.scheduledAt !== undefined && data.scheduledAt !== null) {
  data.status = PublicationStatus.SCHEDULED;
  
  await this.prisma.post.updateMany({
    where: {
      publicationId: id,
      scheduledAt: null
    },
    data: {
      status: PostStatus.PENDING,
      errorMessage: null
    }
  });
}
```

#### 3. Posts Service

**File**: `src/modules/posts/posts.service.ts`

**Method `update`**:

```typescript
// When setting scheduledAt for post
if (data.scheduledAt !== undefined && data.scheduledAt !== null) {
  const publication = await this.prisma.publication.findUnique({
    where: { id: post.publicationId },
    select: { scheduledAt: true }
  });
  
  if (!publication.scheduledAt) {
    throw new BadRequestException(
      'Cannot set scheduledAt for post when publication has no scheduledAt'
    );
  }
  
  data.status = PostStatus.PENDING;
  data.errorMessage = null;
}

// When removing scheduledAt from post
if (data.scheduledAt === null) {
  data.errorMessage = null;
}
```

#### 4. Schema Comments

**File**: `prisma/schema.prisma`

Update comment for `status` field:
```prisma
// Publication status (user can select: DRAFT, READY; system sets: SCHEDULED, PROCESSING, PUBLISHED, PARTIAL, FAILED, EXPIRED)
status        PublicationStatus @default(DRAFT)
```

### Frontend

#### 1. Publication Form

**File**: `ui/app/components/PublicationForm.vue`

**Changes**:
- Status selector: show only DRAFT and READY
- Display SCHEDULED as read-only badge when `scheduledAt` is set
- Add tooltip: "Status SCHEDULED is set automatically when scheduling"
- **Disable** "Change Publication Time" button if `content` is empty
- Show banner: "Fill content field to schedule publication" when `content` is empty

#### 2. Post Form/Component

**File**: Post editing component (need to identify exact file)

**Changes**:
- **Disable** `scheduledAt` field if `publication.scheduledAt` is not set
- Show tooltip: "Set publication time first to schedule individual posts"

#### 3. Composables

**File**: `ui/app/composables/usePublications.ts`

**Changes**:
- Add function `getUserSelectableStatuses()` returning only DRAFT and READY
- Update status change logic to handle automatic SCHEDULED

**File**: `ui/app/utils/publications.ts`

**Add function**:
```typescript
export function getUserSelectableStatuses(t: (key: string) => string) {
  return [
    { value: 'DRAFT', label: t('publications.status.draft') },
    { value: 'READY', label: t('publications.status.ready') }
  ];
}
```

#### 4. Translations

**Files**:
- `ui/app/locales/ru-RU.json`
- `ui/app/locales/en-US.json`

**Add keys**:
```json
{
  "publications.validation.contentRequired": "Fill content field to schedule publication",
  "publications.validation.publicationTimeRequired": "Set publication time first",
  "publications.status.scheduledAutomatic": "Status SCHEDULED is set automatically when scheduling"
}
```

### Tests

#### Unit Tests

**File**: `test/unit/publications.service.spec.ts`

**Add tests**:
1. `should reset posts when changing status to DRAFT`
2. `should reset posts when changing status to READY`
3. `should validate content when changing status to READY`
4. `should auto-set SCHEDULED when scheduledAt is set`
5. `should validate content when setting scheduledAt`
6. `should reset posts without own scheduledAt when publication scheduledAt changes`

**File**: `test/unit/posts.service.spec.ts`

**Add tests**:
1. `should prevent setting post scheduledAt without publication scheduledAt`
2. `should reset post status to PENDING when scheduledAt is set`
3. `should clear errorMessage when scheduledAt is removed`

## UI/UX Requirements

### Publication Page

**When `content` is empty**:
- ❌ "Change Publication Time" button is **disabled**
- ℹ️ Show banner: "Fill content field to schedule publication"

**When `content` is filled**:
- ✅ "Change Publication Time" button is **enabled**
- Setting `scheduledAt` automatically changes status to SCHEDULED

**Status Selector**:
- Show only: DRAFT, READY
- If status is SCHEDULED, show as read-only badge with tooltip

### Post Form

**When `publication.scheduledAt` is not set**:
- ❌ Post `scheduledAt` field is **disabled**
- ℹ️ Show tooltip: "Set publication time first to schedule individual posts"

**When `publication.scheduledAt` is set**:
- ✅ Post `scheduledAt` field is **enabled**
- User can set custom time for individual post

## Validation Summary

| Field | Condition | Validation |
|-------|-----------|------------|
| `publication.status` | User sets to READY | `content` must be filled |
| `publication.scheduledAt` | User sets value | `content` must be filled |
| `post.scheduledAt` | User sets value | `publication.scheduledAt` must be set |

## Migration Notes

No database migration required - only business logic changes.

## Rollout Plan

1. **Backend**: Implement validation and status change logic
2. **Backend Tests**: Add unit tests for new logic
3. **Frontend**: Update UI components and forms
4. **Frontend**: Add validation messages and tooltips
5. **Manual Testing**: Verify all status change scenarios
6. **Documentation**: Update API documentation

## Related Files

### Backend
- `src/modules/publications/dto/create-publication.dto.ts`
- `src/modules/publications/dto/update-publication.dto.ts`
- `src/modules/publications/publications.service.ts`
- `src/modules/posts/posts.service.ts`
- `src/common/validators/is-user-status.validator.ts` (new)
- `prisma/schema.prisma`

### Frontend
- `ui/app/components/PublicationForm.vue`
- `ui/app/composables/usePublications.ts`
- `ui/app/utils/publications.ts`
- `ui/app/locales/ru-RU.json`
- `ui/app/locales/en-US.json`

### Tests
- `test/unit/publications.service.spec.ts`
- `test/unit/posts.service.spec.ts`
