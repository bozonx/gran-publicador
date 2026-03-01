import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useApi, useApiAction, useI18n } from '#imports';
import { useTemplatesStore } from '~/stores/templates';
import type { LlmPromptTemplate } from '~/types/llm-prompt-template';

export function useLlmPromptTemplates() {
  const api = useApi();
  const { executeAction } = useApiAction();
  const { t } = useI18n();
  const store = useTemplatesStore();

  const {
    systemTemplates,
    userTemplates,
    projectTemplates,
    availableOrder,
    isLoading,
    error,
  } = storeToRefs(store);

  // Helper bindings for store state to be used with executeAction
  const loadingBinding = computed({
    get: () => store.isLoading,
    set: (val) => store.setLoading(val)
  });
  const errorBinding = computed({
    get: () => store.error,
    set: (val) => store.setError(val)
  });

  // ─── Aggregated available templates ─────────────────────────────────

  async function fetchAvailableTemplates(params: { projectId?: string } = {}): Promise<{
    system: LlmPromptTemplate[];
    user: LlmPromptTemplate[];
    project: LlmPromptTemplate[];
    order: string[];
  }> {
    const [, result] = await executeAction(
      async () => {
        const data = await api.get<{
          system: LlmPromptTemplate[];
          user: LlmPromptTemplate[];
          project: LlmPromptTemplate[];
          order: string[];
        }>('/llm-prompt-templates/available', { params });
        
        store.setSystemTemplates(data.system || []);
        store.setUserTemplates(data.user || []);
        store.setProjectTemplates(data.project || []);
        store.setAvailableOrder(data.order || []);
        
        return data;
      },
      { loadingRef: loadingBinding, errorRef: errorBinding, silentErrors: true }
    );
    return result || { system: [], user: [], project: [], order: [] };
  }

  async function setAvailableOrder(data: { projectId: string; ids: string[] }): Promise<boolean> {
    const [err] = await executeAction(
      async () => {
        await api.post('/llm-prompt-templates/available/order', data);
        store.setAvailableOrder(data.ids);
      },
      { loadingRef: loadingBinding, errorRef: errorBinding, successMessage: t('common.saveSuccess') }
    );
    return !err;
  }

  // ─── System templates ───────────────────────────────────────────────

  async function fetchSystemTemplates(includeHidden = false): Promise<LlmPromptTemplate[]> {
    const [, result] = await executeAction(
      async () => {
        const templates = await api.get<LlmPromptTemplate[]>('/llm-prompt-templates/system', {
          params: { includeHidden: includeHidden ? 'true' : undefined },
        });
        store.setSystemTemplates(templates);
        return templates;
      },
      { loadingRef: loadingBinding, errorRef: errorBinding, silentErrors: true }
    );
    return result || [];
  }

  async function hideSystemTemplate(systemId: string): Promise<boolean> {
    const [err] = await executeAction(
      async () => {
        await api.post(`/llm-prompt-templates/system/${encodeURIComponent(systemId)}/hide`);
        // We might need to refresh or find and update in list
        await fetchSystemTemplates(true);
      },
      { loadingRef: loadingBinding, errorRef: errorBinding, successMessage: t('common.saveSuccess') }
    );
    return !err;
  }

  async function unhideSystemTemplate(systemId: string): Promise<boolean> {
    const [err] = await executeAction(
      async () => {
        await api.post(`/llm-prompt-templates/system/${encodeURIComponent(systemId)}/unhide`);
        await fetchSystemTemplates(true);
      },
      { loadingRef: loadingBinding, errorRef: errorBinding, successMessage: t('common.saveSuccess') }
    );
    return !err;
  }

  // ─── User / Project templates ───────────────────────────────────────

  async function fetchUserTemplates(
    userId: string,
    includeHidden = false,
  ): Promise<LlmPromptTemplate[]> {
    const [, result] = await executeAction(
      async () => {
        const templates = await api.get<LlmPromptTemplate[]>(`/llm-prompt-templates/user/${userId}`, {
          params: { includeHidden: includeHidden ? 'true' : undefined },
        });
        store.setUserTemplates(templates);
        return templates;
      },
      { loadingRef: loadingBinding, errorRef: errorBinding, silentErrors: true }
    );
    return result || [];
  }

  async function fetchProjectTemplates(
    projectId: string,
    includeHidden = false,
  ): Promise<LlmPromptTemplate[]> {
    const [, result] = await executeAction(
      async () => {
        const templates = await api.get<LlmPromptTemplate[]>(`/llm-prompt-templates/project/${projectId}`, {
          params: { includeHidden: includeHidden ? 'true' : undefined },
        });
        store.setProjectTemplates(templates);
        return templates;
      },
      { loadingRef: loadingBinding, errorRef: errorBinding, silentErrors: true }
    );
    return result || [];
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
    const sanitizedData = {
      ...data,
      name: data.name?.trim() || undefined,
      note: data.note?.trim() || undefined,
    };

    const [, result] = await executeAction(
      async () => {
        const template = await api.post<LlmPromptTemplate>('/llm-prompt-templates', sanitizedData);
        if (template.projectId) {
          store.setProjectTemplates([...store.projectTemplates, template]);
        } else if (template.userId) {
          store.setUserTemplates([...store.userTemplates, template]);
        }
        return template;
      },
      { loadingRef: loadingBinding, errorRef: errorBinding, successMessage: t('llm.createTemplateSuccess') }
    );
    return result;
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
    const sanitizedData = {
      ...data,
      name: data.name?.trim() || undefined,
      note: data.note?.trim() || undefined,
    };

    const [, result] = await executeAction(
      async () => {
        const updated = await api.patch<LlmPromptTemplate>(`/llm-prompt-templates/${id}`, sanitizedData);
        store.updateTemplateInLists(updated);
        return updated;
      },
      { loadingRef: loadingBinding, errorRef: errorBinding, successMessage: t('llm.updateTemplateSuccess') }
    );
    return result;
  }

  async function deleteTemplate(id: string): Promise<boolean> {
    const [err] = await executeAction(
      async () => {
        await api.delete(`/llm-prompt-templates/${id}`);
        store.removeTemplateFromLists(id);
      },
      { loadingRef: loadingBinding, errorRef: errorBinding, successMessage: t('llm.deleteTemplateSuccess') }
    );
    return !err;
  }

  // ─── Hide / Unhide for custom templates ─────────────────────────────

  async function hideTemplate(id: string): Promise<boolean> {
    const [err] = await executeAction(
      async () => {
        await api.post(`/llm-prompt-templates/${id}/hide`);
        // Refresh appropriate list or update in place if possible
      },
      { loadingRef: loadingBinding, errorRef: errorBinding, successMessage: t('common.saveSuccess') }
    );
    return !err;
  }

  async function unhideTemplate(id: string): Promise<boolean> {
    const [err] = await executeAction(
      async () => {
        await api.post(`/llm-prompt-templates/${id}/unhide`);
      },
      { loadingRef: loadingBinding, errorRef: errorBinding, successMessage: t('common.saveSuccess') }
    );
    return !err;
  }

  // ─── Reorder ────────────────────────────────────────────────────────

  async function reorderTemplates(ids: string[]): Promise<boolean> {
    const [err] = await executeAction(
      async () => await api.post('/llm-prompt-templates/reorder', { ids }),
      { loadingRef: loadingBinding, errorRef: errorBinding }
    );
    return !err;
  }

  // ─── Copy targets ──────────────────────────────────────────────────

  async function fetchCopyTargets(): Promise<Array<{ id: string; name: string }>> {
    const [, result] = await executeAction(
      async () => await api.get<Array<{ id: string; name: string }>>('/llm-prompt-templates/copy-targets'),
      { silentErrors: true }
    );
    return result || [];
  }

  return {
    systemTemplates,
    userTemplates,
    projectTemplates,
    availableOrder,
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
