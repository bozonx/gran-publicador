import type { LlmPromptTemplate } from '~/types/llm-prompt-template';
import { useApi } from './useApi';

export function useLlmPromptTemplates() {
  const $api = useApi();
  const toast = useToast();
  const { t } = useI18n();

  const isLoading = ref(false);
  const error = ref<string | null>(null);

  async function fetchUserTemplates(userId: string): Promise<LlmPromptTemplate[]> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await $api.get<LlmPromptTemplate[]>(`/llm-prompt-templates/user/${userId}`);
      return response;
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch user templates';
      toast.add({
        title: t('common.error'),
        description: error.value || 'Failed to fetch user templates',
        color: 'error',
      });
      return [];
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchProjectTemplates(projectId: string): Promise<LlmPromptTemplate[]> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await $api.get<LlmPromptTemplate[]>(
        `/llm-prompt-templates/project/${projectId}`,
      );
      return response;
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch project templates';
      toast.add({
        title: t('common.error'),
        description: error.value || 'Failed to fetch project templates',
        color: 'error',
      });
      return [];
    } finally {
      isLoading.value = false;
    }
  }

  async function createTemplate(data: {
    name: string;
    description?: string;
    category?: 'GENERAL' | 'CHAT' | 'CONTENT' | 'EDITING' | 'METADATA';
    prompt: string;
    order?: number;
    userId?: string;
    projectId?: string;
  }): Promise<LlmPromptTemplate | null> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await $api.post<LlmPromptTemplate>('/llm-prompt-templates', data);

      toast.add({
        title: t('llm.createTemplateSuccess'),
        color: 'success',
      });

      return response;
    } catch (err: any) {
      error.value = err.message || 'Failed to create template';
      toast.add({
        title: t('common.error'),
        description: error.value || 'Failed to create template',
        color: 'error',
      });
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  async function updateTemplate(
    id: string,
    data: {
      name?: string;
      description?: string;
      category?: 'GENERAL' | 'CHAT' | 'CONTENT' | 'EDITING' | 'METADATA';
      prompt?: string;
      order?: number;
    },
  ): Promise<LlmPromptTemplate | null> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await $api.patch<LlmPromptTemplate>(`/llm-prompt-templates/${id}`, data);

      toast.add({
        title: t('llm.updateTemplateSuccess'),
        color: 'success',
      });

      return response;
    } catch (err: any) {
      error.value = err.message || 'Failed to update template';
      toast.add({
        title: t('common.error'),
        description: error.value || 'Failed to update template',
        color: 'error',
      });
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  async function deleteTemplate(id: string): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      await $api.delete(`/llm-prompt-templates/${id}`);

      toast.add({
        title: t('llm.deleteTemplateSuccess'),
        color: 'success',
      });

      return true;
    } catch (err: any) {
      error.value = err.message || 'Failed to delete template';
      toast.add({
        title: t('common.error'),
        description: error.value || 'Failed to delete template',
        color: 'error',
      });
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function reorderTemplates(ids: string[]): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      await $api.post('/llm-prompt-templates/reorder', { ids });

      return true;
    } catch (err: any) {
      error.value = err.message || 'Failed to reorder templates';
      toast.add({
        title: t('common.error'),
        description: error.value || 'Failed to reorder templates',
        color: 'error',
      });
      return false;
    } finally {
      isLoading.value = false;
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
  };
}
