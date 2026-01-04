<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

const { t } = useI18n()
const router = useRouter()
const { createProject, isLoading } = useProjects()
const { canGoBack, goBack } = useNavigation()

/**
 * Handle project creation
 */
async function handleCreate(data: { name: string; description: string }) {
  const project = await createProject({
    name: data.name,
    description: data.description || undefined,
  })

  if (project) {
    // Navigate to the created project
    router.push(`/projects/${project.id}`)
  } else {
    throw new Error('Failed to create project')
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
    <FormsProjectForm :is-loading="isLoading" @submit="handleCreate" @cancel="handleCancel" />
  </div>
</template>
