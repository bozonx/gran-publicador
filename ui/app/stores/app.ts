type Theme = 'light' | 'dark' | 'system'

interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  duration?: number
}

/**
 * App store using Pinia Setup Store syntax for better TypeScript support
 */
export const useAppStore = defineStore('app', () => {
  // State
  const isSidebarOpen = ref(false)
  const isLoading = ref(false)
  const theme = ref<Theme>('system')
  const currentProjectId = ref<string | null>(null)
  const toasts = ref<Toast[]>([])

  // Getters
  const hasCurrentProject = computed(() => !!currentProjectId.value)

  // Actions
  function toggleSidebar() {
    isSidebarOpen.value = !isSidebarOpen.value
  }

  function setSidebarOpen(isOpen: boolean) {
    isSidebarOpen.value = isOpen
  }

  function setLoading(loading: boolean) {
    isLoading.value = loading
  }

  function setTheme(newTheme: Theme) {
    theme.value = newTheme
  }

  function setCurrentProject(projectId: string | null) {
    currentProjectId.value = projectId
  }

  function addToast(toast: Omit<Toast, 'id'>) {
    const id = crypto.randomUUID()
    toasts.value.push({ ...toast, id })

    // Auto-remove after duration
    const duration = toast.duration ?? 5000
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }

    return id
  }

  function removeToast(id: string) {
    const index = toasts.value.findIndex((t) => t.id === id)
    if (index > -1) {
      toasts.value.splice(index, 1)
    }
  }

  function clearToasts() {
    toasts.value = []
  }

  // Convenience methods for toasts
  function showSuccess(message: string, duration?: number) {
    return addToast({ type: 'success', message, duration })
  }

  function showError(message: string, duration?: number) {
    return addToast({ type: 'error', message, duration })
  }

  function showWarning(message: string, duration?: number) {
    return addToast({ type: 'warning', message, duration })
  }

  function showInfo(message: string, duration?: number) {
    return addToast({ type: 'info', message, duration })
  }

  return {
    // State
    isSidebarOpen,
    isLoading,
    theme,
    currentProjectId,
    toasts,

    // Getters
    hasCurrentProject,

    // Actions
    toggleSidebar,
    setSidebarOpen,
    setLoading,
    setTheme,
    setCurrentProject,
    addToast,
    removeToast,
    clearToasts,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  }
})
