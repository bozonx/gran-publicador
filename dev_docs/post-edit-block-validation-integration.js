// Example integration for PostEditBlock.vue
// Add this code to integrate social media validation

// 1. Import the composable (add to imports section)
import { useSocialMediaValidation } from '~/composables/useSocialMediaValidation'

// 2. Initialize the composable (add after other composables)
const { validatePostContent, getContentLength, getRemainingCharacters } = useSocialMediaValidation()

// 3. Add computed properties for validation (add after other computed properties)
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

// 4. Update isValid to include validation result
const isValid = computed(() => {
  if (props.isCreating) return !!formData.channelId && validationResult.value.isValid
  return validationResult.value.isValid
})

// 5. Add template code after content editor (around line 768)
/*
<!-- Validation Errors -->
<UAlert
  v-if="!validationResult.isValid"
  color="error"
  variant="soft"
  icon="i-heroicons-exclamation-circle"
  class="mt-2"
>
  <template #title>{{ t('validation.checkFormErrors') }}</template>
  <ul class="list-disc list-inside space-y-1">
    <li v-for="error in validationResult.errors" :key="error.field">
      {{ error.message }}
    </li>
  </ul>
</UAlert>

<!-- Character Counter -->
<div v-if="remainingCharacters !== null" class="mt-2 text-sm flex items-center justify-between">
  <span class="text-gray-500 dark:text-gray-400">
    {{ t('editor.characters') }}: <span class="font-medium">{{ contentLength }}</span>
  </span>
  <span 
    :class="[
      'font-medium',
      remainingCharacters < 0 
        ? 'text-red-500 dark:text-red-400' 
        : remainingCharacters < 100 
          ? 'text-amber-500 dark:text-amber-400' 
          : 'text-gray-400 dark:text-gray-500'
    ]"
  >
    {{ remainingCharacters >= 0 ? '+' : '' }}{{ remainingCharacters }}
  </span>
</div>
*/
