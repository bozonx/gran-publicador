<script setup lang="ts">
import { usePublications } from '~/composables/usePublications'
import type { PublicationWithRelations } from '~/types/publications'

const props = defineProps<{
  publicationId: string
  currentProjectId?: string
}>()

const isOpen = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const api = useApi()
const toast = useToast()
const router = useRouter()

const targetProjectId = ref<string | undefined>(props.currentProjectId)
const isCopying = ref(false)

async function handleCopy() {
    if (!targetProjectId.value) return
    isCopying.value = true
    try {
        const result = await api.post<PublicationWithRelations>(`/publications/${props.publicationId}/copy`, { 
            projectId: targetProjectId.value 
        })
        if (result && result.id) {
            isOpen.value = false
            toast.add({
              title: t('common.success'),
              description: t('common.saveSuccess'),
              color: 'success'
            })
            router.push(`/publications/${result.id}/edit`)
        }
    } catch (err: any) {
        toast.add({
            title: t('common.error'),
            description: t('common.saveError'),
            color: 'error'
        })
    } finally {
        isCopying.value = false
    }
}

watch(isOpen, (val) => {
    if (val) {
        targetProjectId.value = props.currentProjectId
    }
})
</script>

<template>
  <AppModal v-model:open="isOpen" :title="t('publication.copyToProject')" :ui="{ content: 'sm:max-w-md' }">
    <div class="space-y-4">
      <p class="text-sm text-gray-500 dark:text-gray-400">
        {{ t('publication.copyToProjectDescription', 'Select a target project to copy this publication to.') }}
      </p>
      <UFormField :label="t('project.title')">
        <CommonProjectSelect v-model="targetProjectId" class="w-full" />
      </UFormField>
    </div>
    <template #footer>
      <UButton color="neutral" variant="ghost" @click="isOpen = false">
        {{ t('common.cancel') }}
      </UButton>
      <UButton color="primary" :loading="isCopying" :disabled="!targetProjectId" @click="handleCopy">
        {{ t('common.copy') }}
      </UButton>
    </template>
  </AppModal>
</template>
