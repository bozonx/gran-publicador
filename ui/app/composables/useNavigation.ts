import { computed } from 'vue'
import { useRouter } from 'vue-router'

/**
 * Composable for unified navigation behavior
 * Provides consistent "back" button functionality that works both
 * for browser back button and interface back buttons
 */
export function useNavigation() {
  const router = useRouter()

  /**
   * Check if there's navigation history available within the current app
   * Returns true if user can go back in browser history and the previous page
   * belongs to the same origin (prevents navigation to external sites)
   */
  const canGoBack = computed(() => {
    // Check if there's a previous page in the current session
    const hasHistory = window.history.state?.back !== null && window.history.state?.back !== undefined
    
    if (!hasHistory) {
      return false
    }

    // Check if the previous URL belongs to the same origin
    // This prevents navigating to external sites
    try {
      const previousUrl = window.history.state?.back
      if (!previousUrl) {
        return false
      }

      // If it's a relative URL (starts with /), it's safe
      if (previousUrl.startsWith('/')) {
        return true
      }

      // If it's an absolute URL, check the origin
      const url = new URL(previousUrl, window.location.origin)
      return url.origin === window.location.origin
    } catch {
      // If URL parsing fails, assume it's not safe
      return false
    }
  })

  /**
   * Navigate back in history
   * Uses browser's back functionality which works with both
   * browser back button and interface back buttons
   * Only navigates if the previous page is within the same application
   */
  function goBack() {
    if (canGoBack.value) {
      router.back()
    }
  }

  return {
    canGoBack,
    goBack
  }
}
