import { ref, computed, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { registerDirtyForm, confirmLeaveDirtyForm } from './useDirtyFormsManager'

// Global flag to ensure we only register one navigation guard
let navigationGuardRegistered = false

/**
 * Composable for tracking form dirty state (unsaved changes)
 * 
 * @param formData - Reactive form data object
 * @param options - Configuration options
 * @returns Object with dirty state tracking utilities
 */
export function useFormDirtyState<T extends Record<string, any>>(
  formData: T,
  options: {
    /** Enable browser warning when leaving page with unsaved changes */
    enableBeforeUnload?: boolean
    /** Enable router navigation guard */
    enableNavigationGuard?: boolean
    /** Custom comparison function for dirty state detection */
    compareFn?: (original: T, current: T) => boolean
  } = {}
) {
  const { enableBeforeUnload = true, enableNavigationGuard = true, compareFn } = options

  const router = useRouter()
  const { t } = useI18n()

  // Generate unique ID for this form instance
  const formId = `form-${Math.random().toString(36).substr(2, 9)}`

  // Store original form data as JSON string for comparison
  const originalDataJson = ref<string>('')
  const isInitialized = ref(false)

  /**
   * Save current form state as the "clean" baseline
   */
  function saveOriginalState() {
    originalDataJson.value = JSON.stringify(formData)
    isInitialized.value = true
  }

  /**
   * Reset form to original saved state
   */
  function resetToOriginal() {
    if (!isInitialized.value) return

    try {
      const original = JSON.parse(originalDataJson.value)
      Object.keys(original).forEach((key) => {
        if (key in formData) {
          ;(formData as any)[key] = original[key]
        }
      })
    } catch (error) {
      console.error('Failed to reset form data:', error)
    }
  }

  /**
   * Check if form has unsaved changes
   */
  const isDirty = computed(() => {
    if (!isInitialized.value) return false

    if (compareFn) {
      try {
        const original = JSON.parse(originalDataJson.value)
        return compareFn(original, formData)
      } catch {
        return false
      }
    }

    const currentJson = JSON.stringify(formData)
    return currentJson !== originalDataJson.value
  })

  /**
   * Browser beforeunload handler to warn about unsaved changes
   */
  function handleBeforeUnload(e: BeforeUnloadEvent) {
    if (isDirty.value) {
      e.preventDefault()
      // Modern browsers ignore custom messages, but setting returnValue is required
      e.returnValue = ''
      return ''
    }
  }

  // Setup beforeunload listener
  if (enableBeforeUnload && typeof window !== 'undefined') {
    window.addEventListener('beforeunload', handleBeforeUnload)
  }

  // Register this form in the global manager
  let unregisterForm: (() => void) | undefined

  if (enableNavigationGuard) {
    const confirmMessage = t('form.resetConfirm', 'Are you sure you want to leave? You have unsaved changes.')
    unregisterForm = registerDirtyForm(formId, () => isDirty.value, confirmMessage)

    // Register global navigation guard only once
    if (!navigationGuardRegistered && router) {
      navigationGuardRegistered = true
      
      router.beforeEach(async (to, from, next) => {
        const canLeave = await confirmLeaveDirtyForm()
        if (canLeave) {
          next()
        } else {
          next(false)
        }
      })
    }
  }

  // Cleanup on unmount
  onBeforeUnmount(() => {
    if (enableBeforeUnload && typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
    if (unregisterForm) {
      unregisterForm()
    }
  })

  return {
    /** Whether the form has unsaved changes */
    isDirty,
    /** Whether the form state has been initialized */
    isInitialized,
    /** Save current form state as clean baseline */
    saveOriginalState,
    /** Reset form to last saved state */
    resetToOriginal,
  }
}
