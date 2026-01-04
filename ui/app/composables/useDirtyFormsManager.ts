import { ref } from 'vue'

interface DirtyForm {
  id: string
  isDirty: () => boolean
  message: string
}

// Global registry of dirty forms
const dirtyForms = ref<Map<string, DirtyForm>>(new Map())

// Global flag to prevent multiple confirms
let isConfirming = false

/**
 * Register a form that can be dirty
 */
export function registerDirtyForm(id: string, isDirty: () => boolean, message: string) {
  dirtyForms.value.set(id, { id, isDirty, message })
  
  return () => {
    dirtyForms.value.delete(id)
  }
}

/**
 * Check if any registered form is dirty
 */
export function hasAnyDirtyForm(): DirtyForm | null {
  for (const form of dirtyForms.value.values()) {
    if (form.isDirty()) {
      return form
    }
  }
  return null
}

// Global state for confirmation modal
export const confirmModalState = ref({
  isOpen: false,
  title: '',
  description: '',
  confirmLabel: '',
  cancelLabel: '',
  resolve: null as ((value: boolean) => void) | null,
})

/**
 * Show confirmation dialog for dirty forms
 * Returns Promise<boolean>
 */
export async function confirmLeaveDirtyForm(message?: string): Promise<boolean> {
  if (isConfirming) {
    return true // Prevent nested confirms
  }
  
  const dirtyForm = hasAnyDirtyForm()
  if (!dirtyForm) {
    return true
  }
  
  isConfirming = true
  
  return new Promise<boolean>((resolve) => {
    confirmModalState.value = {
      isOpen: true,
      title: 'Unsaved Changes', // Will be localized in component
      description: message || dirtyForm.message,
      confirmLabel: 'Leave', // Will be localized
      cancelLabel: 'Stay', // Will be localized
      resolve: (result: boolean) => {
        isConfirming = false
        confirmModalState.value.isOpen = false
        confirmModalState.value.resolve = null
        resolve(result)
      }
    }
  })
}
