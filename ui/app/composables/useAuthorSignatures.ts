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

  const { executeAction } = useApiAction();

  async function fetchByProject(projectId: string): Promise<ProjectAuthorSignature[]> {
    const [, result] = await executeAction(
      async () => await api.get<ProjectAuthorSignature[]>(`/projects/${projectId}/author-signatures`),
      { loadingRef: isLoading, errorRef: error, silentErrors: true }
    );
    return result || [];
  }

  async function create(
    projectId: string,
    data: CreateAuthorSignatureInput,
  ): Promise<ProjectAuthorSignature | null> {
    const [, result] = await executeAction(
      async () => await api.post<ProjectAuthorSignature>(`/projects/${projectId}/author-signatures`, data),
      { loadingRef: isLoading, errorRef: error }
    );
    return result;
  }

  async function update(
    id: string,
    data: UpdateAuthorSignatureInput,
  ): Promise<ProjectAuthorSignature | null> {
    const [, result] = await executeAction(
      async () => await api.patch<ProjectAuthorSignature>(`/author-signatures/${id}`, data),
      { loadingRef: isLoading, errorRef: error }
    );
    return result;
  }

  async function upsertVariant(
    signatureId: string,
    language: string,
    data: UpsertVariantInput,
  ): Promise<ProjectAuthorSignatureVariant | null> {
    const [, result] = await executeAction(
      async () => await api.put<ProjectAuthorSignatureVariant>(`/author-signatures/${signatureId}/variants/${language}`, data),
      { loadingRef: isLoading, errorRef: error }
    );
    return result;
  }

  async function deleteVariant(signatureId: string, language: string): Promise<boolean> {
    const [err] = await executeAction(
      async () => await api.delete(`/author-signatures/${signatureId}/variants/${language}`),
      { loadingRef: isLoading, errorRef: error }
    );
    return !err;
  }

  async function reorder(projectId: string, data: { signatureIds: string[] }): Promise<ProjectAuthorSignature[]> {
    const [, result] = await executeAction(
      async () => await api.post<ProjectAuthorSignature[]>(`/projects/${projectId}/author-signatures/reorder`, data),
      { loadingRef: isLoading, errorRef: error }
    );
    return result || [];
  }

  async function updateWithVariants(id: string, data: any): Promise<ProjectAuthorSignature | null> {
    const [, result] = await executeAction(
      async () => await api.patch<ProjectAuthorSignature>(`/author-signatures/${id}`, data),
      { loadingRef: isLoading, errorRef: error }
    );
    return result;
  }

  async function remove(id: string): Promise<boolean> {
    const [err] = await executeAction(
      async () => await api.delete(`/author-signatures/${id}`),
      { loadingRef: isLoading, errorRef: error }
    );
    return !err;
  }

  return {
    isLoading,
    error,
    fetchByProject,
    create,
    update,
    updateWithVariants,
    reorder,
    upsertVariant,
    deleteVariant,
    remove,
  };
}
