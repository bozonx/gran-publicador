export interface StatusOption {
  value: string;
  label: string;
}

export function getUserSelectableStatuses(t: (key: string) => string): StatusOption[] {
  return [
    { value: 'DRAFT', label: t('publicationStatus.draft') },
    { value: 'READY', label: t('publicationStatus.ready') }
  ];
}
