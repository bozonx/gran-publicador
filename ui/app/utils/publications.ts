export interface StatusOption {
  value: string;
  label: string;
}

export function getUserSelectableStatuses(t: (key: string) => string): StatusOption[] {
  return [
    { value: 'DRAFT', label: t('publications.status.draft') },
    { value: 'READY', label: t('publications.status.ready') }
  ];
}
