import { useApi, useApiAction, useI18n } from '#imports';
import { usePublicationState } from './usePublicationState';

export function usePublicationBulk() {
  const api = useApi();
  const { executeAction } = useApiAction();
  const { isLoading } = usePublicationState();
  const { t } = useI18n();

  async function bulkOperation(ids: string[], operation: string, status?: string, targetProjectId?: string): Promise<boolean> {
    const [err] = await executeAction(
      async () => {
        const payload: Record<string, string | string[] | undefined> = { ids, operation, status, targetProjectId };
        Object.keys(payload).forEach(key => (payload[key] === undefined || payload[key] === null) && delete payload[key]);
        await api.post('/publications/bulk', payload);
      },
      { loadingRef: isLoading, successMessage: t('common.success') }
    );
    return !err;
  }

  return { bulkOperation };
}
