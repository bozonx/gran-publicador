interface SchedulerRunResponse<T = Record<string, unknown>> {
  status: 'completed'
  scheduler: string
  result: T
}

export const useAdminMaintenance = () => {
  const api = useApi()

  const runPublications = async () => {
    return await api.post<SchedulerRunResponse>('/system/schedulers/publications/run')
  }

  const runNews = async () => {
    return await api.post<SchedulerRunResponse>('/system/schedulers/news/run')
  }

  const runMaintenance = async () => {
    return await api.post<SchedulerRunResponse>('/system/schedulers/maintenance/run')
  }

  return {
    runPublications,
    runNews,
    runMaintenance,
  }
}
