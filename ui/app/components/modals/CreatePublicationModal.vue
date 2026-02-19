<script setup lang="ts">
import type { PostType } from '~/types/posts'
import PublicationCreateForm from '~/components/publications/PublicationCreateForm.vue'

interface Props {
  projectId?: string
  preselectedLanguage?: string
  preselectedChannelId?: string
  preselectedPostType?: PostType
  preselectedChannelIds?: string[]
  allowProjectSelection?: boolean
  prefilledTitle?: string
  prefilledContent?: string
  prefilledMediaIds?: any[]
  prefilledTags?: string[]
  prefilledNote?: string
  prefilledContentItemIds?: string[]
  prefilledUnsplashId?: string
}

const props = withDefaults(defineProps<Props>(), {
  allowProjectSelection: false,
})

const emit = defineEmits<{
  (e: 'success', publicationId: string): void
  (e: 'close'): void
}>()

const { t } = useI18n()
const router = useRouter()
const isOpen = defineModel<boolean>('open', { required: true })

const isProjectLocked = computed(() => {
  if (props.allowProjectSelection) return false
  return Boolean(props.projectId) || Boolean(props.preselectedChannelId)
})
const isChannelLocked = computed(() => Boolean(props.preselectedChannelId))
const isLanguageLocked = computed(() => {
  if (props.allowProjectSelection) return false
  return Boolean(props.preselectedChannelId) || Boolean(props.preselectedLanguage)
})

function handleSuccess(publicationId: string) {
  isOpen.value = false
  emit('success', publicationId)
  router.push(`/publications/${publicationId}/edit`)
}

function handleCancel() {
  isOpen.value = false
  emit('close')
}
</script>

<template>
  <UiAppModal v-model:open="isOpen" :title="t('publication.create')">
    <PublicationCreateForm
      :project-id="props.projectId"
      :preselected-language="props.preselectedLanguage"
      :preselected-channel-id="props.preselectedChannelId"
      :preselected-post-type="props.preselectedPostType"
      :preselected-channel-ids="props.preselectedChannelIds"
      :prefilled-title="props.prefilledTitle"
      :prefilled-content="props.prefilledContent"
      :prefilled-media-ids="props.prefilledMediaIds"
      :prefilled-tags="props.prefilledTags"
      :prefilled-note="props.prefilledNote"
      :prefilled-content-item-ids="props.prefilledContentItemIds"
      :prefilled-unsplash-id="props.prefilledUnsplashId"
      :is-project-locked="isProjectLocked"
      :is-channel-locked="isChannelLocked"
      :is-language-locked="isLanguageLocked"
      @success="handleSuccess"
      @cancel="handleCancel"
    />
  </UiAppModal>
</template>
