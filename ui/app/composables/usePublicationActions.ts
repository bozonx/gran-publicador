import { computed } from 'vue';
import type { PublicationWithRelations } from '~/types/publications';

export function usePublicationActions(publicationRef: Ref<PublicationWithRelations | null>) {
  const { t } = useI18n();
  const { updatePublication, fetchPublication } = usePublications();
  const { updatePost } = usePosts();
  const toast = useToast();
  const api = useApi();

  const normalizedPublicationMeta = computed<Record<string, any>>(() => {
    const meta = (publicationRef.value as any)?.meta;

    if (typeof meta === 'object' && meta !== null) return meta;

    if (typeof meta === 'string' && meta.trim()) {
      try {
        const parsed = JSON.parse(meta);
        return typeof parsed === 'object' && parsed !== null ? parsed : {};
      } catch {
        return {};
      }
    }

    return {};
  });

  const majoritySchedule = computed(() => {
    if (!publicationRef.value?.posts?.length) return { date: null, conflict: false };

    // Collect dates: prefer publishedAt, then scheduledAt (for view)
    // In edit.vue it was scheduledAt || publishedAt
    // Let's unify: publishedAt || scheduledAt
    const dates = publicationRef.value.posts
      .map((p: any) => p.publishedAt || p.scheduledAt)
      .filter((d: string | null) => !!d) as string[];

    if (dates.length === 0) return { date: null, conflict: false };

    const counts: Record<string, number> = {};
    dates.forEach((d) => {
      counts[d] = (counts[d] || 0) + 1;
    });

    let maxCount = 0;
    let majorityDate = null;

    for (const [date, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        majorityDate = date;
      }
    }

    const uniqueDates = Object.keys(counts);
    const conflict = uniqueDates.length > 1;

    return { date: majorityDate, conflict };
  });

  async function applyLlmResult(data: {
    publication?: { title?: string; description?: string; tags?: string; content?: string };
    posts?: Array<{ channelId: string; content?: string; tags?: string }>;
    meta?: Record<string, any>;
  }, callbacks?: { onSuccess?: () => void; onError?: () => void }) {
    if (!publicationRef.value) return;

    try {
      // Use the new Batch API
      await api.patch(`/publications/${publicationRef.value.id}/apply-llm`, data);

      // Refresh publication to reflect all changes
      await fetchPublication(publicationRef.value.id);

      toast.add({
        title: t('llm.applySuccess'),
        color: 'success',
      });
      callbacks?.onSuccess?.();
    } catch (e: any) {
      toast.add({
        title: t('llm.applyError'),
        description: t('common.saveError'),
        color: 'error',
      });
      callbacks?.onError?.();
    }
  }

  return {
    normalizedPublicationMeta,
    majoritySchedule,
    applyLlmResult,
  };
}
