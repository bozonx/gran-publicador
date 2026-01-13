<script setup lang="ts">
import { FORM_STYLES } from '~/utils/design-tokens'
const { t } = useI18n()
const toast = useToast()

const emit = defineEmits<{
  (e: 'created', projectId: string): void
}>()

const isOpen = defineModel<boolean>('open', { required: true })

const { projects, fetchProjects, createProject } = useProjects()

const isCreating = ref(false)
const formState = reactive({
  name: '',
  description: ''
})

function resetForm() {
  formState.name = ''
  formState.description = ''
}

async function handleCreate() {
  if (!formState.name || formState.name.length < 2) return

  isCreating.value = true
  try {
    const project = await createProject({
      name: formState.name,
      description: formState.description || undefined
    })

    if (project) {

      
      resetForm()
      isOpen.value = false
      emit('created', project.id)
    }
  } catch (error: any) {
    toast.add({
      title: t('common.error'),
      description: error.message || t('common.saveError'),
      color: 'error'
    })
  } finally {
    isCreating.value = false
  }
}

function handleClose() {
  resetForm()
  isOpen.value = false
}

// Reset form when modal opens
watch(isOpen, (open) => {
  if (open) {
    resetForm()
  }
})
</script>

<template>
  <UiAppModal v-model:open="isOpen" :title="t('project.createProject')">
    <form id="create-project-form" @submit.prevent="handleCreate" class="space-y-6">
      <UFormField :label="t('project.name')" required>
        <UInput 
          v-model="formState.name" 
          :placeholder="t('project.namePlaceholder')" 
          autofocus 
          class="w-full" 
          size="lg" 
        />
      </UFormField>

      <UFormField :label="t('project.description')" :help="t('common.optional')">
        <UTextarea 
          v-model="formState.description" 
          :placeholder="t('project.descriptionPlaceholder')" 
          :rows="FORM_STYLES.textareaRows" 
          autoresize
          class="w-full" 
        />
      </UFormField>
    </form>

    <template #footer>
      <UButton 
        color="neutral" 
        variant="ghost" 
        :disabled="isCreating" 
        @click="handleClose"
      >
        {{ t('common.cancel') }}
      </UButton>
      <UButton 
        color="primary" 
        :loading="isCreating" 
        :disabled="!formState.name || formState.name.length < 2" 
        form="create-project-form"
        type="submit"
      >
        {{ t('common.create') }}
      </UButton>
    </template>
  </UiAppModal>
</template>
