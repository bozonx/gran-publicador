interface SchedulerRunResponse<T = Record<string, unknown>> {
  status: 'completed'
  scheduler: string
  result: T
}

export const useAdminMaintenance = () => {
  const api = useApi()
  const { executeAction } = useApiAction()
  const { t } = useI18n()

  const isLoading = ref(false)

  const runPublications = async () => {
    return await executeAction(
      async () => await api.post<SchedulerRunResponse>('/system/schedulers/publications/run'),
      { loadingRef: isLoading, successMessage: t('admin.schedulerStarted') }
    )
  }

  const runNews = async () => {
    return await executeAction(
      async () => await api.post<SchedulerRunResponse>('/system/schedulers/news/run'),
      { loadingRef: isLoading, successMessage: t('admin.schedulerStarted') }
    )
  }

  const runMaintenance = async () => {
    return await executeAction(
      async () => await api.post<SchedulerRunResponse>('/system/schedulers/maintenance/run'),
      { loadingRef: isLoading, successMessage: t('admin.schedulerStarted') }
    )
  }

  return {
    isLoading,
    runPublications,
    runNews,
    runMaintenance,
  }
}
