import { ref } from 'vue';
import type { ProjectTemplate, TemplateBlock } from '~/types/channels';
import { logger } from '~/utils/logger';

export interface CreateProjectTemplateInput {
  name: string;
  postType?: string | null;
  isDefault?: boolean;
  language?: string;
  template: TemplateBlock[];
}

export interface UpdateProjectTemplateInput {
  name?: string;
  postType?: string | null;
  isDefault?: boolean;
  language?: string;
  template?: TemplateBlock[];
}

export function useProjectTemplates() {
  const api = useApi();
  const { t } = useI18n();
  const toast = useToast();

  const templates = ref<ProjectTemplate[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  async function fetchProjectTemplates(projectId: string): Promise<ProjectTemplate[]> {
    isLoading.value = true;
    error.value = null;

    try {
      const data = await api.get<ProjectTemplate[]>(`/projects/${projectId}/templates`);
      templates.value = data;
      return data;
    } catch (err: any) {
      const message = err.message || 'Failed to fetch project templates';
      error.value = message;
      logger.error('fetchProjectTemplates error:', err);
      toast.add({
        title: t('common.error'),
        description: message,
        color: 'error',
      });
      return [];
    } finally {
      isLoading.value = false;
    }
  }

  async function createProjectTemplate(
    projectId: string,
    data: CreateProjectTemplateInput,
  ): Promise<ProjectTemplate | null> {
    isLoading.value = true;
    error.value = null;

    try {
      const result = await api.post<ProjectTemplate>(`/projects/${projectId}/templates`, data);
      templates.value.push(result);
      
      // If the new template is now the default, unset default for all other templates
      if (result.isDefault) {
        templates.value.forEach((t) => {
          if (t.id !== result.id && t.isDefault) {
            t.isDefault = false;
          }
        });
      }
      return result;
    } catch (err: any) {
      const message = err.message || 'Failed to create project template';
      error.value = message;
      logger.error('createProjectTemplate error:', err);
      toast.add({
        title: t('common.error'),
        description: message,
        color: 'error',
      });
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  async function updateProjectTemplate(
    projectId: string,
    templateId: string,
    data: UpdateProjectTemplateInput,
  ): Promise<ProjectTemplate | null> {
    isLoading.value = true;
    error.value = null;

    try {
      const result = await api.patch<ProjectTemplate>(
        `/projects/${projectId}/templates/${templateId}`,
        data,
      );
      const idx = templates.value.findIndex(t => t.id === templateId);
      if (idx !== -1) {
        templates.value[idx] = result;
        
        // If the updated template is now the default, unset default for all other templates
        if (result.isDefault) {
          templates.value.forEach((t, i) => {
            if (i !== idx && t.isDefault) {
              t.isDefault = false;
            }
          });
        }
      }
      return result;
    } catch (err: any) {
      const message = err.message || 'Failed to update project template';
      error.value = message;
      logger.error('updateProjectTemplate error:', err);
      toast.add({
        title: t('common.error'),
        description: message,
        color: 'error',
      });
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  async function deleteProjectTemplate(projectId: string, templateId: string): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      await api.delete(`/projects/${projectId}/templates/${templateId}`);
      templates.value = templates.value.filter(t => t.id !== templateId);
      toast.add({
        title: t('common.success'),
        description: t('projectTemplates.deleted'),
        color: 'success',
      });
      return true;
    } catch (err: any) {
      const message = err.message || 'Failed to delete project template';
      error.value = message;
      logger.error('deleteProjectTemplate error:', err);
      toast.add({
        title: t('common.error'),
        description: message,
        color: 'error',
      });
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function reorderProjectTemplates(projectId: string, ids: string[]): Promise<boolean> {
    try {
      await api.patch(`/projects/${projectId}/templates/reorder`, { ids });
      // Re-sort local templates
      const idOrder = new Map(ids.map((id, i) => [id, i]));
      templates.value.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));
      return true;
    } catch (err: any) {
      const message = err.message || 'Failed to reorder project templates';
      error.value = message;
      logger.error('reorderProjectTemplates error:', err);
      toast.add({
        title: t('common.error'),
        description: message,
        color: 'error',
      });
      return false;
    }
  }

  return {
    templates,
    isLoading,
    error,
    fetchProjectTemplates,
    createProjectTemplate,
    updateProjectTemplate,
    deleteProjectTemplate,
    reorderProjectTemplates,
  };
}
