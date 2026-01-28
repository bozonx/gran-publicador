import { ref, watch, type Ref } from 'vue'
import { useRouter } from 'vue-router'
import { AUTO_SAVE_DEBOUNCE_MS } from '~/constants/autosave'

export type SaveStatus = 'saved' | 'saving' | 'error'

export interface AutosaveOptions<T> {
  // Function to save data
  saveFn: (data: T) => Promise<void>
  
  // Data to watch for changes
  data: Ref<T | null>
  
  // Debounce time in milliseconds
  debounceMs?: number
  
  // Skip initial watch trigger
  skipInitial?: boolean
  
  // Custom equality check function
  isEqual?: (a: T, b: T) => boolean
}

export interface AutosaveReturn {
  saveStatus: Ref<SaveStatus>
  saveError: Ref<string | null>
  lastSavedAt: Ref<Date | null>
  isDirty: Ref<boolean>
  forceSave: () => Promise<void>
}

/**
 * Composable for auto-saving data with debouncing, dirty checking, and navigation guards
 */
export function useAutosave<T>(options: AutosaveOptions<T>): AutosaveReturn {
  const {
    saveFn,
    data,
    debounceMs = AUTO_SAVE_DEBOUNCE_MS,
    skipInitial = true,
    isEqual = defaultIsEqual,
  } = options

  const router = useRouter()
  const toast = useToast()

  const saveStatus = ref<SaveStatus>('saved')
  const saveError = ref<string | null>(null)
  const lastSavedAt = ref<Date | null>(null)
  const isDirty = ref(false)
  
  // Store last saved state for dirty checking
  const lastSavedState = ref<T | null>(null)
  
  // Promise queue to ensure sequential saves
  let saveQueue = Promise.resolve()

  /**
   * Perform the actual save operation
   */
  async function performSave() {
    if (!data.value) return
    
    // Check if data is dirty
    if (lastSavedState.value && isEqual(data.value, lastSavedState.value)) {
      return
    }

    // Add to queue to ensure sequential execution
    saveQueue = saveQueue.then(async () => {
      saveStatus.value = 'saving'
      saveError.value = null
      isDirty.value = false

      try {
        await saveFn(data.value!)
        
        // Update last saved state
        lastSavedState.value = deepClone(data.value!)
        
        saveStatus.value = 'saved'
        lastSavedAt.value = new Date()
      } catch (err: any) {
        console.error('Auto-save failed:', err)
        saveStatus.value = 'error'
        saveError.value = err.message || 'Failed to save'
        isDirty.value = true

        toast.add({
          title: 'Auto-save Error',
          description: saveError.value,
          color: 'error',
          icon: 'i-heroicons-exclamation-triangle',
        })
      }
    })

    await saveQueue
  }

  // Debounced save function
  const debouncedSave = useDebounceFn(performSave, debounceMs)

  // Watch for changes
  let isInitialWatch = true
  watch(
    data,
    (newValue, oldValue) => {
      // Skip initial watch trigger
      if (skipInitial && isInitialWatch) {
        isInitialWatch = false
        // Store initial state
        if (newValue) {
          lastSavedState.value = deepClone(newValue)
        }
        return
      }

      if (!newValue) return

      // Check if this is a reference change (e.g., switching tabs)
      // vs actual data modification
      const isReferenceChange = oldValue && newValue !== oldValue && 
        (oldValue as any).id !== (newValue as any).id

      if (isReferenceChange) {
        // If the previous object was dirty, we should try to save it before switching
        if (isDirty.value && oldValue) {
          // Use the old data to perform save
          console.log('Forcing save of old state before reference change')
          saveFn(oldValue).catch(err => console.error('Failed to save old state on switch:', err))
        }
        
        // This is a tab switch or similar - update saved state without saving for the NEW value
        lastSavedState.value = deepClone(newValue)
        isDirty.value = false
        return
      }

      // This is an actual data change - mark as dirty and trigger save
      isDirty.value = true
      debouncedSave()
    },
    { deep: true }
  )


  // Navigation guard - prevent navigation while saving
  onBeforeRouteLeave((to, from, next) => {
    if (saveStatus.value === 'saving') {
      const answer = window.confirm(
        'Данные еще сохраняются. Вы уверены, что хотите покинуть страницу?'
      )
      if (answer) {
        next()
      } else {
        next(false)
      }
    } else {
      next()
    }
  })

  // Browser unload guard - prevent closing tab while saving
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (saveStatus.value === 'saving') {
      e.preventDefault()
      e.returnValue = ''
      return ''
    }
  }

  onMounted(() => {
    window.addEventListener('beforeunload', handleBeforeUnload)
  })

  onUnmounted(() => {
    window.removeEventListener('beforeunload', handleBeforeUnload)
  })

  return {
    saveStatus,
    saveError,
    lastSavedAt,
    isDirty,
    forceSave: performSave,
  }
}

/**
 * Default equality check using JSON serialization
 */
function defaultIsEqual<T>(a: T, b: T): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

/**
 * Deep clone using JSON serialization
 */
function deepClone<T>(obj: T): T {
  try {
    return JSON.parse(JSON.stringify(obj))
  } catch {
    return obj
  }
}
