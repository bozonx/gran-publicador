<script setup lang="ts">
import { usePublications } from '~/composables/usePublications'

const props = defineProps<{
  publicationId: string
  projectId?: string | null
}>()

const emit = defineEmits<{
  (e: 'deleted', projectId?: string | null): void
}>()

const isOpen = defineModel<boolean>('open', { default: false })
const { deletePublication } = usePublications()
const { t } = useI18n()
const isDeleting = ref(false)

async function handleDelete() {
  isDeleting.value = true
  const success = await deletePublication(props.publicationId)
  isDeleting.value = false
  if (success) {
    isOpen.value = false
    emit('deleted', props.projectId)
  }
}
</script>

<template>
  <UiConfirmModal
    v-if="isOpen"
    v-model:open="isOpen"
    :title="t('publication.deleteConfirm')"
    :description="t('publication.deleteCascadeWarning')"
    :confirm-text="t('common.delete')"
    color="error"
    icon="i-heroicons-exclamation-triangle"
    :loading="isDeleting"
    @confirm="handleDelete"
  />
</template>
