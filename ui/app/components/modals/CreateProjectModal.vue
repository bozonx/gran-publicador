<script setup lang="ts">
const { t } = useI18n()
const toast = useToast()

const emit = defineEmits<{
  (e: 'created', projectId: string): void
}>()

const isOpen = defineModel<boolean>('open', { required: true })

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
    const { createProject } = useProjects()
    const project = await createProject({
      name: formState.name,
      description: formState.description || undefined
    })

    if (project) {
      toast.add({
        title: t('common.success'),
        description: t('project.createSuccess'),
        color: 'success'
      })
      
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
  <UModal v-model:open="isOpen">
    <template #content>
      <div class="p-6 min-w-[500px]">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
            {{ t('project.createProject') }}
          </h2>
          <UButton 
            color="neutral" 
            variant="ghost" 
            icon="i-heroicons-x-mark" 
            size="sm" 
            @click="handleClose" 
          />
        </div>

        <form @submit.prevent="handleCreate" class="space-y-6">
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
              :rows="3" 
              class="w-full" 
            />
          </UFormField>

          <div class="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
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
              type="submit"
            >
              {{ t('common.create') }}
            </UButton>
          </div>
        </form>
      </div>
    </template>
  </UModal>
</template>
