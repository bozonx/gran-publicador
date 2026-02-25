import type { LlmPromptTemplate } from '~/types/llm-prompt-template';
import { useApi } from './useApi';

export function useLlmPromptTemplates() {
  const $api = useApi();
  const toast = useToast();
  const { t } = useI18n();

  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // ─── Aggregated available templates ─────────────────────────────────

  async function fetchAvailableTemplates(params: { projectId?: string } = {}): Promise<{
    system: LlmPromptTemplate[];
    user: LlmPromptTemplate[];
    project: LlmPromptTemplate[];
    order: string[];
  }> {
    isLoading.value = true;
    error.value = null;

    try {
      return await $api.get<{
        system: LlmPromptTemplate[];
        user: LlmPromptTemplate[];
        project: LlmPromptTemplate[];
        order: string[];
      }>('/llm-prompt-templates/available', { params });
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch templates';
      toast.add({
        title: t('common.error'),
        description: error.value || 'Failed to fetch templates',
        color: 'error',
      });
      return { system: [], user: [], project: [], order: [] };
    } finally {
      isLoading.value = false;
    }
  }

  async function setAvailableOrder(data: { projectId: string; ids: string[] }): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      await $api.post('/llm-prompt-templates/available/order', data);
      toast.add({ title: t('common.saveSuccess'), color: 'success' });
      return true;
    } catch (err: any) {
      error.value = err.message || 'Failed to save templates order';
      toast.add({
        title: t('common.error'),
        description: error.value || 'Failed to save templates order',
        color: 'error',
      });
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  // ─── System templates ───────────────────────────────────────────────

  async function fetchSystemTemplates(includeHidden = false): Promise<LlmPromptTemplate[]> {
    isLoading.value = true;
    error.value = null;

    try {
      return await $api.get<LlmPromptTemplate[]>('/llm-prompt-templates/system', {
        params: { includeHidden: includeHidden ? 'true' : undefined },
      });
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch system templates';
      toast.add({
        title: t('common.error'),
        description: error.value || 'Failed to fetch system templates',
        color: 'error',
      });
      return [];
    } finally {
      isLoading.value = false;
    }
  }

  async function hideSystemTemplate(systemId: string): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      await $api.post(`/llm-prompt-templates/system/${encodeURIComponent(systemId)}/hide`);
      toast.add({ title: t('common.saveSuccess'), color: 'success' });
      return true;
    } catch (err: any) {
      error.value = err.message || 'Failed to hide system template';
      toast.add({
        title: t('common.error'),
        description: error.value || 'Failed to hide system template',
        color: 'error',
      });
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function unhideSystemTemplate(systemId: string): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      await $api.post(`/llm-prompt-templates/system/${encodeURIComponent(systemId)}/unhide`);
      toast.add({ title: t('common.saveSuccess'), color: 'success' });
      return true;
    } catch (err: any) {
      error.value = err.message || 'Failed to unhide system template';
      toast.add({
        title: t('common.error'),
        description: error.value || 'Failed to unhide system template',
        color: 'error',
      });
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  // ─── User / Project templates ───────────────────────────────────────

  async function fetchUserTemplates(
    userId: string,
    includeHidden = false,
  ): Promise<LlmPromptTemplate[]> {
    isLoading.value = true;
    error.value = null;

    try {
      return await $api.get<LlmPromptTemplate[]>(`/llm-prompt-templates/user/${userId}`, {
        params: { includeHidden: includeHidden ? 'true' : undefined },
      });
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

  async function fetchProjectTemplates(
    projectId: string,
    includeHidden = false,
  ): Promise<LlmPromptTemplate[]> {
    isLoading.value = true;
    error.value = null;

    try {
      return await $api.get<LlmPromptTemplate[]>(`/llm-prompt-templates/project/${projectId}`, {
        params: { includeHidden: includeHidden ? 'true' : undefined },
      });
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

  // ─── CRUD ──────────────────────────────────────────────────────────

  async function createTemplate(data: {
    name?: string;
    note?: string;
    category?: string;
    prompt: string;
    order?: number;
    userId?: string;
    projectId?: string;
  }): Promise<LlmPromptTemplate | null> {
    isLoading.value = true;
    error.value = null;

    const sanitizedData = {
      ...data,
      name: data.name?.trim() || undefined,
      note: data.note?.trim() || undefined,
    };

    try {
      const response = await $api.post<LlmPromptTemplate>('/llm-prompt-templates', sanitizedData);
      toast.add({ title: t('llm.createTemplateSuccess'), color: 'success' });
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
      note?: string;
      category?: string;
      prompt?: string;
      order?: number;
    },
  ): Promise<LlmPromptTemplate | null> {
    isLoading.value = true;
    error.value = null;

    const sanitizedData = {
      ...data,
      name: data.name?.trim() || undefined,
      note: data.note?.trim() || undefined,
    };

    try {
      const response = await $api.patch<LlmPromptTemplate>(`/llm-prompt-templates/${id}`, sanitizedData);
      toast.add({ title: t('llm.updateTemplateSuccess'), color: 'success' });
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
      toast.add({ title: t('llm.deleteTemplateSuccess'), color: 'success' });
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

  // ─── Hide / Unhide for custom templates ─────────────────────────────

  async function hideTemplate(id: string): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      await $api.post(`/llm-prompt-templates/${id}/hide`);
      toast.add({ title: t('common.saveSuccess'), color: 'success' });
      return true;
    } catch (err: any) {
      error.value = err.message || 'Failed to hide template';
      toast.add({
        title: t('common.error'),
        description: error.value || 'Failed to hide template',
        color: 'error',
      });
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function unhideTemplate(id: string): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      await $api.post(`/llm-prompt-templates/${id}/unhide`);
      toast.add({ title: t('common.saveSuccess'), color: 'success' });
      return true;
    } catch (err: any) {
      error.value = err.message || 'Failed to unhide template';
      toast.add({
        title: t('common.error'),
        description: error.value || 'Failed to unhide template',
        color: 'error',
      });
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  // ─── Reorder ────────────────────────────────────────────────────────

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

  // ─── Copy targets ──────────────────────────────────────────────────

  async function fetchCopyTargets(): Promise<Array<{ id: string; name: string }>> {
    try {
      return await $api.get<Array<{ id: string; name: string }>>(
        '/llm-prompt-templates/copy-targets',
      );
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch copy targets';
      return [];
    }
  }

  return {
    isLoading,
    error,
    fetchAvailableTemplates,
    setAvailableOrder,
    fetchSystemTemplates,
    fetchUserTemplates,
    fetchProjectTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    reorderTemplates,
    hideSystemTemplate,
    unhideSystemTemplate,
    hideTemplate,
    unhideTemplate,
    fetchCopyTargets,
  };
}
