<script setup lang="ts">
import { usePublications } from '~/composables/usePublications'

const props = defineProps<{
  publicationId: string
  initialProjectId?: string
}>()

const emit = defineEmits<{
  (e: 'refresh'): void
}>()

const isOpen = defineModel<boolean>('open', { default: false })
const { copyPublication } = usePublications()
const { t } = useI18n()
const api = useApi()
const router = useRouter()
const toast = useToast()

const targetProjectId = ref<string | undefined>(props.initialProjectId)
const isSaving = ref(false)

async function handleCopy() {
    if (!targetProjectId.value) return
    isSaving.value = true
    try {
        // In consistency with PublicationEditModals.vue which used { projectId } 
        // We'll call API directly or fix copyPublication
        const result = await api.post<any>(`/publications/${props.publicationId}/copy`, { projectId: targetProjectId.value })
        if (result && result.id) {
            isOpen.value = false
            toast.add({
              title: t('common.success'),
              description: t('common.saveSuccess'),
              color: 'success'
            })
            router.push(`/publications/${result.id}/edit`)
            emit('refresh')
        }
    } finally {
        isSaving.value = false
    }
}
</script>

<template>
  <AppModal v-model:open="isOpen" :title="t('publication.copyToProject')" :ui="{ content: 'sm:max-w-md' }">
    <div class="space-y-4">
      <UFormField :label="t('project.title')">
        <CommonProjectSelect v-model="targetProjectId" class="w-full" />
      </UFormField>
    </div>
    <template #footer>
      <UButton color="neutral" variant="ghost" @click="isOpen = false">{{ t('common.cancel') }}</UButton>
      <UButton color="primary" :loading="isSaving" :disabled="!targetProjectId" @click="handleCopy">{{ t('common.copy') }}</UButton>
    </template>
  </AppModal>
</template>
