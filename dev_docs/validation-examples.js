// =============================================================================
// EXAMPLES: Social Media Validation Usage
// =============================================================================

// =============================================================================
// 1. CLIENT-SIDE VALIDATION (Vue Component)
// =============================================================================

// Example 1: Basic validation in a component
import { useSocialMediaValidation } from '~/composables/useSocialMediaValidation'

export default {
  setup() {
    const { validatePostContent, getContentLength, getRemainingCharacters } = useSocialMediaValidation()

    const content = ref('Hello, this is my post!')
    const mediaCount = ref(0)
    const socialMedia = ref('TELEGRAM')

    // Validate content
    const validationResult = computed(() => {
      return validatePostContent(
        content.value,
        mediaCount.value,
        socialMedia.value
      )
    })

    // Get content length (without HTML)
    const contentLength = computed(() => {
      return getContentLength(content.value)
    })

    // Get remaining characters
    const remaining = computed(() => {
      return getRemainingCharacters(
        content.value,
        mediaCount.value,
        socialMedia.value
      )
    })

    return {
      validationResult,
      contentLength,
      remaining
    }
  }
}

// =============================================================================
// 2. TEMPLATE USAGE (Vue Template)
// =============================================================================

/*
<template>
  <div>
    <!-- Show validation errors -->
    <UAlert
      v-if="!validationResult.isValid"
      color="error"
      variant="soft"
      icon="i-heroicons-exclamation-circle"
    >
      <template #title>{{ t('validation.checkFormErrors') }}</template>
      <ul class="list-disc list-inside space-y-1">
        <li v-for="error in validationResult.errors" :key="error.field">
          {{ error.message }}
        </li>
      </ul>
    </UAlert>

    <!-- Character counter -->
    <div class="text-sm text-gray-500">
      {{ contentLength }} / {{ contentLength + remaining }}
      <span :class="remaining < 0 ? 'text-red-500' : ''">
        ({{ remaining }} remaining)
      </span>
    </div>

    <!-- Disable save button if invalid -->
    <UButton
      :disabled="!validationResult.isValid"
      @click="handleSave"
    >
      Save
    </UButton>
  </div>
</template>
*/

// =============================================================================
// 3. SERVER-SIDE VALIDATION (NestJS DTO)
// =============================================================================

import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { IsSocialMediaContentValid } from '../../common/validators';

// Example DTO with validation
export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  public channelId!: string;

  @IsString()
  @IsNotEmpty()
  public publicationId!: string;

  @IsString()
  @IsOptional()
  public socialMedia?: string;

  @IsString()
  @IsOptional()
  @IsSocialMediaContentValid()
  public content?: string | null;

  // Important: These fields are needed for validation
  // They can be computed in the service layer
  public mediaCount?: number;
}

// =============================================================================
// 4. SERVICE LAYER VALIDATION (NestJS Service)
// =============================================================================

import { validatePostContent } from '../common/validators';
import { SocialMedia } from '../generated/prisma/enums';

export class PostsService {
  async createPost(dto: CreatePostDto) {
    // Get media count from publication
    const publication = await this.prisma.publication.findUnique({
      where: { id: dto.publicationId },
      include: { media: true }
    });

    const mediaCount = publication?.media?.length || 0;

    // Validate content
    const validationResult = validatePostContent({
      content: dto.content,
      mediaCount,
      socialMedia: dto.socialMedia as SocialMedia
    });

    if (!validationResult.isValid) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: validationResult.errors
      });
    }

    // Create post...
  }
}

// =============================================================================
// 5. DIRECT VALIDATION FUNCTION USAGE
// =============================================================================

import { validatePostContent } from './social-media-validation.validator';
import { SocialMedia } from '../../generated/prisma/enums';

// Example 1: Text-only post
const result1 = validatePostContent({
  content: 'Short text',
  mediaCount: 0,
  socialMedia: SocialMedia.TELEGRAM
});
// result1.isValid = true

// Example 2: Post with media (caption validation)
const result2 = validatePostContent({
  content: 'A'.repeat(2000), // 2000 characters
  mediaCount: 5,
  socialMedia: SocialMedia.TELEGRAM
});
// result2.isValid = false (caption max is 1024 for Telegram)
// result2.errors = ['Caption length (2000) exceeds maximum allowed (1024) for TELEGRAM']

// Example 3: Too many media files
const result3 = validatePostContent({
  content: 'Text',
  mediaCount: 15,
  socialMedia: SocialMedia.TELEGRAM
});
// result3.isValid = false
// result3.errors = ['Media count (15) exceeds maximum allowed (10) for TELEGRAM']

// =============================================================================
// 6. GET VALIDATION RULES
// =============================================================================

import { getValidationRules } from './social-media-validation.constants';
import { SocialMedia } from '../../generated/prisma/enums';

const telegramRules = getValidationRules(SocialMedia.TELEGRAM);
console.log(telegramRules);
// {
//   maxTextLength: 4096,
//   maxCaptionLength: 1024,
//   maxMediaCount: 10
// }

// =============================================================================
// 7. INTEGRATION IN PostEditBlock.vue
// =============================================================================

// Add to script setup section:
const { validatePostContent, getContentLength, getRemainingCharacters } = useSocialMediaValidation()

const mediaCount = computed(() => {
  return props.publication?.media?.length || 0
})

const validationResult = computed(() => {
  if (!selectedChannel.value?.socialMedia) {
    return { isValid: true, errors: [] }
  }

  const content = displayContent.value
  return validatePostContent(
    content,
    mediaCount.value,
    selectedChannel.value.socialMedia as any
  )
})

const contentLength = computed(() => {
  return getContentLength(displayContent.value)
})

const remainingCharacters = computed(() => {
  if (!selectedChannel.value?.socialMedia) return null

  return getRemainingCharacters(
    displayContent.value,
    mediaCount.value,
    selectedChannel.value.socialMedia as any
  )
})

// Update isValid:
const isValid = computed(() => {
  if (props.isCreating) return !!formData.channelId && validationResult.value.isValid
  return validationResult.value.isValid
})

// =============================================================================
// 8. HTML STRIPPING EXAMPLE
// =============================================================================

import { getContentLength } from '~/composables/useSocialMediaValidation'

const htmlContent = '<p>Hello <strong>world</strong>!</p>'
const length = getContentLength(htmlContent)
// length = 12 (HTML tags are stripped)

// =============================================================================
// 9. REACTIVE VALIDATION
// =============================================================================

const content = ref('')
const mediaFiles = ref([])

// Automatically validates when content or media changes
const validation = computed(() => {
  return validatePostContent(
    content.value,
    mediaFiles.value.length,
    'TELEGRAM'
  )
})

// Watch for changes
watch(validation, (newVal) => {
  if (!newVal.isValid) {
    console.warn('Validation failed:', newVal.errors)
  }
})

// =============================================================================
// 10. CONDITIONAL VALIDATION
// =============================================================================

// Only validate if channel is selected
const shouldValidate = computed(() => {
  return !!selectedChannel.value?.socialMedia
})

const validationResult = computed(() => {
  if (!shouldValidate.value) {
    return { isValid: true, errors: [] }
  }

  return validatePostContent(
    content.value,
    mediaCount.value,
    selectedChannel.value.socialMedia
  )
})
