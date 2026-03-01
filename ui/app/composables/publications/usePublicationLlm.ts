import { useApi, useApiAction } from '#imports';
import { usePublicationState } from './usePublicationState';
import { normalizePublication } from './utils';
import type { 
  PublicationWithRelations,
  PublicationLlmChatInput,
  PublicationLlmChatResponse
} from '~/types/publications';

export function usePublicationLlm() {
  const api = useApi();
  const { executeAction } = useApiAction();
  const { currentPublication } = usePublicationState();

  async function publicationLlmChat(publicationId: string, payload: PublicationLlmChatInput, options: any = {}) {
    return await api.post<PublicationLlmChatResponse>(`/publications/${publicationId}/llm/chat`, payload, options);
  }

  async function applyLlmResult(id: string, data: any): Promise<PublicationWithRelations> {
    const [, result] = await executeAction(
      async () => {
        const res = await api.patch<PublicationWithRelations>(`/publications/${id}/apply-llm`, data);
        const normalized = normalizePublication(res);
        if (currentPublication.value?.id === id) currentPublication.value = normalized;
        return normalized;
      },
      { throwOnError: true }
    );
    return result as PublicationWithRelations;
  }

  return { publicationLlmChat, applyLlmResult };
}
