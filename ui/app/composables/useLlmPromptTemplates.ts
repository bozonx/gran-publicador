import type { LlmPromptTemplate } from '~/types/llm-prompt-template'

export function useLlmPromptTemplates() {
  const { $api } = useNuxtApp()
  const toast = useToast()
  const { t } = useI18n()

  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function fetchUserTemplates(userId: string): Promise<LlmPromptTemplate[]> {
    isLoading.value = true
    error.value = null

    try {
      const response = await $api<LlmPromptTemplate[]>(`/llm-prompt-templates/user/${userId}`)
      return response
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch user templates'
      toast.add({
        title: t('common.error'),
        description: error.value,
        color: 'error',
      })
      return []
    } finally {
      isLoading.value = false
    }
  }

  async function fetchProjectTemplates(projectId: string): Promise<LlmPromptTemplate[]> {
    isLoading.value = true
    error.value = null

    try {
      const response = await $api<LlmPromptTemplate[]>(`/llm-prompt-templates/project/${projectId}`)
      return response
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch project templates'
      toast.add({
        title: t('common.error'),
        description: error.value,
        color: 'error',
      })
      return []
    } finally {
      isLoading.value = false
    }
  }

  async function createTemplate(data: {
    name: string
    description?: string
    prompt: string
    order?: number
    userId?: string
    projectId?: string
  }): Promise<LlmPromptTemplate | null> {
    isLoading.value = true
    error.value = null

    try {
      const response = await $api<LlmPromptTemplate>('/llm-prompt-templates', {
        method: 'POST',
        body: data,
      })

      toast.add({
        title: t('llm.createTemplateSuccess'),
        color: 'success',
      })

      return response
    } catch (err: any) {
      error.value = err.message || 'Failed to create template'
      toast.add({
        title: t('common.error'),
        description: error.value,
        color: 'error',
      })
      return null
    } finally {
      isLoading.value = false
    }
  }

  async function updateTemplate(
    id: string,
    data: {
      name?: string
      description?: string
      prompt?: string
      order?: number
    },
  ): Promise<LlmPromptTemplate | null> {
    isLoading.value = true
    error.value = null

    try {
      const response = await $api<LlmPromptTemplate>(`/llm-prompt-templates/${id}`, {
        method: 'PATCH',
        body: data,
      })

      toast.add({
        title: t('llm.updateTemplateSuccess'),
        color: 'success',
      })

      return response
    } catch (err: any) {
      error.value = err.message || 'Failed to update template'
      toast.add({
        title: t('common.error'),
        description: error.value,
        color: 'error',
      })
      return null
    } finally {
      isLoading.value = false
    }
  }

  async function deleteTemplate(id: string): Promise<boolean> {
    isLoading.value = true
    error.value = null

    try {
      await $api(`/llm-prompt-templates/${id}`, {
        method: 'DELETE',
      })

      toast.add({
        title: t('llm.deleteTemplateSuccess'),
        color: 'success',
      })

      return true
    } catch (err: any) {
      error.value = err.message || 'Failed to delete template'
      toast.add({
        title: t('common.error'),
        description: error.value,
        color: 'error',
      })
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function reorderTemplates(ids: string[]): Promise<boolean> {
    isLoading.value = true
    error.value = null

    try {
      await $api('/llm-prompt-templates/reorder', {
        method: 'POST',
        body: { ids },
      })

      return true
    } catch (err: any) {
      error.value = err.message || 'Failed to reorder templates'
      toast.add({
        title: t('common.error'),
        description: error.value,
        color: 'error',
      })
      return false
    } finally {
      isLoading.value = false
    }
  }

  return {
    isLoading,
    error,
    fetchUserTemplates,
    fetchProjectTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    reorderTemplates,
  }
}
