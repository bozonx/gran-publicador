import { computed } from 'vue';
import { useI18n } from '#imports';
import { 
  getStatusIcon, 
  getPublicationProblems, 
  getPublicationProblemLevel, 
  getPostProblemLevel,
  getStatusDisplayName as utilGetStatusDisplayName,
  getStatusUiColor as utilGetStatusUiColor
} from '~/utils/publications';

export function usePublicationUi() {
  const { t } = useI18n();

  const statusOptions = computed(() => [
    { value: 'DRAFT', label: t('publicationStatus.draft') },
    { value: 'READY', label: t('publicationStatus.ready') },
    { value: 'SCHEDULED', label: t('publicationStatus.scheduled') },
    { value: 'PROCESSING', label: t('publicationStatus.processing') },
    { value: 'PUBLISHED', label: t('publicationStatus.published') },
    { value: 'PARTIAL', label: t('publicationStatus.partial') },
    { value: 'FAILED', label: t('publicationStatus.failed') },
    { value: 'EXPIRED', label: t('publicationStatus.expired') },
  ]);

  return {
    statusOptions,
    getStatusDisplayName: (s: string) => utilGetStatusDisplayName(s, t),
    getStatusColor: (s: string) => utilGetStatusUiColor(s),
    getStatusIcon,
    getPublicationProblems,
    getPublicationProblemLevel,
    getPostProblemLevel,
  };
}
