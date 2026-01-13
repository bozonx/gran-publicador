# Integration Checklist

## ✅ Completed

- [x] Created validation constants for all social media platforms
- [x] Implemented server-side validation logic
- [x] Created NestJS decorator for DTO validation
- [x] Created Vue composable for client-side validation
- [x] Added Russian translations
- [x] Added English translations
- [x] Created comprehensive documentation
- [x] Created integration examples

## ⏳ TODO: Integration Steps

### 1. Client-side Integration

#### PostEditBlock.vue (`ui/app/components/posts/PostEditBlock.vue`)
- [ ] Add import: `import { useSocialMediaValidation } from '~/composables/useSocialMediaValidation'`
- [ ] Initialize composable
- [ ] Add computed properties for validation
- [ ] Add validation error display in template
- [ ] Add character counter in template
- [ ] Update `isValid` computed to include validation result

**Reference**: `dev_docs/post-edit-block-validation-integration.js`

#### Publication Edit Page (`ui/app/pages/publications/[id]/edit.vue`)
- [ ] Add similar validation logic
- [ ] Show validation errors for each post
- [ ] Show character counter
- [ ] Prevent saving if validation fails

### 2. Server-side Integration

#### Posts DTOs
- [ ] `src/modules/posts/dto/create-post.dto.ts`
  - Add `@IsSocialMediaContentValid()` to content field
  - Ensure `socialMedia` and `mediaCount` fields are available

- [ ] `src/modules/posts/dto/update-post.dto.ts`
  - Add `@IsSocialMediaContentValid()` to content field

#### Publications DTOs
- [ ] `src/modules/publications/dto/create-publication.dto.ts`
  - Add validation logic (may need custom implementation)

- [ ] `src/modules/publications/dto/update-publication.dto.ts`
  - Add validation logic (may need custom implementation)

#### Service Layer
- [ ] Update `PostsService` to calculate `mediaCount` before validation
- [ ] Update `PublicationsService` to calculate `mediaCount` before validation

### 3. Testing

#### Manual Testing
- [ ] Create post with text > 4096 chars for Telegram
- [ ] Create post with caption > 1024 chars for Telegram
- [ ] Add > 10 media files to publication
- [ ] Verify error messages appear
- [ ] Verify character counter works
- [ ] Test in different languages (ru, en)

#### Automated Testing
- [ ] Add unit tests for validation functions
- [ ] Add integration tests for API endpoints
- [ ] Add E2E tests for UI validation

### 4. Documentation Updates
- [ ] Update main README.md with validation info
- [ ] Update API documentation
- [ ] Add validation rules to user guide

## Notes

- Remember to update both client and server validation rules when adding new platforms
- HTML tags are stripped before counting characters
- Caption validation applies when media is present
- Text validation applies when no media

## Questions to Resolve

- [ ] Should we block saving/publishing when validation fails?
- [ ] Should we show warnings or hard errors?
- [ ] Do we need validation for other content types (title, description)?
- [ ] Should we validate media file sizes and formats?
