import { ref } from 'vue';
import type {
  ProjectAuthorSignature,
  ProjectAuthorSignatureVariant,
  CreateAuthorSignatureInput,
  UpdateAuthorSignatureInput,
  UpsertVariantInput,
} from '~/types/author-signatures';

export function useAuthorSignatures() {
  const api = useApi();
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  async function fetchByProject(projectId: string): Promise<ProjectAuthorSignature[]> {
    isLoading.value = true;
    error.value = null;
    try {
      return await api.get<ProjectAuthorSignature[]>(`/projects/${projectId}/author-signatures`);
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch signatures';
      return [];
    } finally {
      isLoading.value = false;
    }
  }

  async function create(
    projectId: string,
    data: CreateAuthorSignatureInput,
  ): Promise<ProjectAuthorSignature | null> {
    isLoading.value = true;
    error.value = null;
    try {
      return await api.post<ProjectAuthorSignature>(
        `/projects/${projectId}/author-signatures`,
        data,
      );
    } catch (err: any) {
      error.value = err.message || 'Failed to create signature';
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  async function update(
    id: string,
    data: UpdateAuthorSignatureInput,
  ): Promise<ProjectAuthorSignature | null> {
    isLoading.value = true;
    error.value = null;
    try {
      return await api.patch<ProjectAuthorSignature>(`/author-signatures/${id}`, data);
    } catch (err: any) {
      error.value = err.message || 'Failed to update signature';
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  async function upsertVariant(
    signatureId: string,
    language: string,
    data: UpsertVariantInput,
  ): Promise<ProjectAuthorSignatureVariant | null> {
    isLoading.value = true;
    error.value = null;
    try {
      return await api.put<ProjectAuthorSignatureVariant>(
        `/author-signatures/${signatureId}/variants/${language}`,
        data,
      );
    } catch (err: any) {
      error.value = err.message || 'Failed to save variant';
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  async function deleteVariant(signatureId: string, language: string): Promise<boolean> {
    isLoading.value = true;
    error.value = null;
    try {
      await api.delete(`/author-signatures/${signatureId}/variants/${language}`);
      return true;
    } catch (err: any) {
      error.value = err.message || 'Failed to delete variant';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function remove(id: string): Promise<boolean> {
    isLoading.value = true;
    error.value = null;
    try {
      await api.delete(`/author-signatures/${id}`);
      return true;
    } catch (err: any) {
      error.value = err.message || 'Failed to delete signature';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  return {
    isLoading,
    error,
    fetchByProject,
    create,
    update,
    upsertVariant,
    deleteVariant,
    remove,
  };
}
