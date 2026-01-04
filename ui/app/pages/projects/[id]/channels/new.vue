<script setup lang="ts">
import type { Channel } from '~/composables/useChannels'

definePageMeta({
  middleware: 'auth',
})

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const { canGoBack, goBack } = useNavigation()
const projectId = computed(() => route.params.id as string)

/**
 * Handle channel creation success
 */
function handleSuccess(channel: Channel) {
  if (channel) {
    // Navigate to the created channel
    router.push(`/projects/${projectId.value}/channels/${channel.id}`)
  }
}

/**
 * Cancel and go back
 */
function handleCancel() {
  goBack()
}
</script>

<template>
  <div class="max-w-4xl mx-auto">
    <!-- Back button -->
    <div class="mb-6">
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-heroicons-arrow-left"
        class="-ml-2.5"
        :disabled="!canGoBack"
        @click="handleCancel"
      >
        {{ t('common.back') }}
      </UButton>
    </div>

    <!-- Create form -->
    <FormsChannelForm 
      :project-id="projectId" 
      @success="handleSuccess" 
      @cancel="handleCancel" 
    />
  </div>
</template>
