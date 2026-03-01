import { useApi, useApiAction } from '#imports';
import { usePublicationState } from './usePublicationState';
import { useArchive } from '~/composables/useArchive';
import { ArchiveEntityType } from '~/types/archive.types';
import type { PublicationWithRelations } from '~/types/publications';

export function usePublicationActions() {
  const api = useApi();
  const { executeAction } = useApiAction();
  const { isLoading } = usePublicationState();
  const { archiveEntity, restoreEntity } = useArchive();

  async function createPostsFromPublication(params: {
    id: string;
    channelIds: string[];
    scheduledAt?: string;
    authorSignatureId?: string;
    authorSignatureOverrides?: Record<string, string>;
    projectTemplateId?: string;
  }): Promise<any> {
    const [, result] = await executeAction(
      async () => {
        const { id, ...body } = params;
        return await api.post(`/publications/${id}/posts`, body);
      },
      { loadingRef: isLoading, throwOnError: true }
    );
    return result;
  }

  async function toggleArchive(publicationId: string, isArchived: boolean) {
    if (isArchived) {
      await restoreEntity(ArchiveEntityType.PUBLICATION, publicationId);
    } else {
      await archiveEntity(ArchiveEntityType.PUBLICATION, publicationId);
    }
  }

  async function copyPublication(id: string, projectId: string): Promise<PublicationWithRelations> {
    const [, result] = await executeAction(
      async () => {
        return await api.post<PublicationWithRelations>(`/publications/${id}/copy`, { projectId });
      },
      { throwOnError: true }
    );
    return result as PublicationWithRelations;
  }

  return { createPostsFromPublication, toggleArchive, copyPublication };
}
