<script setup lang="ts">
import { usePublications } from '~/composables/usePublications'

const props = defineProps<{
  publicationId: string
  initialDate?: string
}>()

const emit = defineEmits<{
  (e: 'refresh'): void
}>()

const isOpen = defineModel<boolean>('open', { default: false })
const { updatePublication } = usePublications()
const { t } = useI18n()
const toast = useToast()

const newScheduledDate = ref(props.initialDate || '')
const isSaving = ref(false)

async function handleSave() {
    if (!newScheduledDate.value) return
    isSaving.value = true
    try {
        await updatePublication(props.publicationId, {
            scheduledAt: new Date(newScheduledDate.value).toISOString()
        })
        toast.add({ title: t('common.success'), description: t('publication.scheduleUpdated'), color: 'success' })
        isOpen.value = false
        emit('refresh')
    } catch (err: any) {
        toast.add({ title: t('common.error'), description: t('common.saveError'), color: 'error' })
    } finally {
        isSaving.value = false
    }
}
</script>

<template>
  <AppModal v-if="isOpen" v-model:open="isOpen" :title="t('publication.changeScheduleTitle')">
    <p class="text-gray-500 dark:text-gray-400 mb-4">{{ t('publication.changeScheduleInfo') }}</p>
    <UFormField :label="t('publication.newScheduleTime')" required>
      <UInput v-model="newScheduledDate" type="datetime-local" class="w-full" icon="i-heroicons-clock" />
    </UFormField>
    <template #footer>
      <UButton color="neutral" variant="ghost" :label="t('common.cancel')" @click="isOpen = false" />
      <UButton color="primary" :label="t('common.save')" :loading="isSaving" @click="handleSave" />
    </template>
  </AppModal>
</template>
