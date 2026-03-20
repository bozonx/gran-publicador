<script setup lang="ts">
import { usePublications } from '~/composables/usePublications'

const props = defineProps<{
  publicationId: string
  templateOptions?: any[]
  initialTemplateId?: string
}>()

const emit = defineEmits<{
  (e: 'refresh'): void
}>()

const isOpen = defineModel<boolean>('open', { default: false })
const { updatePublication } = usePublications()
const { t } = useI18n()

const newTemplateId = ref<string | undefined>(props.initialTemplateId)
const isSaving = ref(false)

async function handleSave() {
    if (!newTemplateId.value) return
    isSaving.value = true
    try {
        await updatePublication(props.publicationId, { projectTemplateId: newTemplateId.value })
        isOpen.value = false
        emit('refresh')
    } finally {
        isSaving.value = false
    }
}
</script>

<template>
  <AppModal v-model:open="isOpen" :title="t('projectTemplates.title')" :ui="{ content: 'sm:max-w-md' }">
    <div class="space-y-4">
      <UFormField :label="t('projectTemplates.title')">
        <USelectMenu v-model="newTemplateId" :items="templateOptions || []" value-key="value" label-key="label" class="w-full" />
      </UFormField>
    </div>
    <template #footer>
      <UButton color="neutral" variant="ghost" @click="isOpen = false">{{ t('common.cancel') }}</UButton>
      <UButton color="primary" :loading="isSaving" :disabled="!newTemplateId" @click="handleSave">{{ t('common.save') }}</UButton>
    </template>
  </AppModal>
</template>
