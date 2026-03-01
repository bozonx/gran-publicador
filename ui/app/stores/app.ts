import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

type Theme = 'light' | 'dark' | 'system'

/**
 * App store using Pinia Setup Store syntax for better TypeScript support
 * Dumb store pattern: only state and simple setters.
 */
export const useAppStore = defineStore('app', () => {
  // State
  const isSidebarOpen = ref(false)
  const isLoading = ref(false)
  const theme = ref<Theme>('system')
  const currentProjectId = ref<string | null>(null)

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

  function reset() {
    isSidebarOpen.value = false
    isLoading.value = false
    theme.value = 'system'
    currentProjectId.value = null
  }

  return {
    // State
    isSidebarOpen,
    isLoading,
    theme,
    currentProjectId,

    // Getters
    hasCurrentProject,

    // Actions
    toggleSidebar,
    setSidebarOpen,
    setLoading,
    setTheme,
    setCurrentProject,
    reset,
  }
})
