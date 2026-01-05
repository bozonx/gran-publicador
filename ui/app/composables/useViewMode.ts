import { ref, computed, watch } from 'vue'

export type ViewMode = 'list' | 'cards'

interface UseViewModeReturn {
  viewMode: Ref<ViewMode>
  toggleViewMode: () => void
  setViewMode: (mode: ViewMode) => void
  isListView: ComputedRef<boolean>
  isCardsView: ComputedRef<boolean>
}

/**
 * Composable for managing view mode (list or cards) with localStorage persistence
 * @param storageKey - unique key for localStorage
 * @param defaultMode - default view mode if not set in localStorage
 */
export function useViewMode(
  storageKey: string,
  defaultMode: ViewMode = 'list'
): UseViewModeReturn {
  const viewMode = ref<ViewMode>(defaultMode)

  // Load from localStorage on client side
  if (import.meta.client) {
    const stored = localStorage.getItem(storageKey)
    if (stored === 'list' || stored === 'cards') {
      viewMode.value = stored
    }
  }

  // Watch for changes and save to localStorage
  if (import.meta.client) {
    watch(viewMode, (newMode) => {
      localStorage.setItem(storageKey, newMode)
    })
  }

  const toggleViewMode = () => {
    viewMode.value = viewMode.value === 'list' ? 'cards' : 'list'
  }

  const setViewMode = (mode: ViewMode) => {
    viewMode.value = mode
  }

  const isListView = computed(() => viewMode.value === 'list')
  const isCardsView = computed(() => viewMode.value === 'cards')

  return {
    viewMode,
    toggleViewMode,
    setViewMode,
    isListView,
    isCardsView,
  }
}
