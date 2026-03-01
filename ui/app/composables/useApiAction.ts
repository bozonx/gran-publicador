import type { Ref } from 'vue'
import { logger } from '~/utils/logger'

export interface ApiActionOptions {
  loadingRef?: Ref<boolean>
  errorRef?: Ref<string | null>
  successMessage?: string
  errorMessage?: string
  silentErrors?: boolean
  throwOnError?: boolean
}

export function useApiAction() {
  const toast = useToast()
  const { t } = useI18n()

  const executeAction = async <T>(
    action: () => Promise<T>,
    options: ApiActionOptions = {}
  ): Promise<[Error | null, T | null]> => {
    if (options.loadingRef) options.loadingRef.value = true
    if (options.errorRef) options.errorRef.value = null

    try {
      const result = await action()
      
      if (options.successMessage) {
        toast.add({
          title: t('common.success'),
          description: options.successMessage,
          color: 'success'
        })
      }
      
      return [null, result]
    } catch (err: any) {
      logger.error('API Action Error', err)
      const message = err.message || options.errorMessage || 'An error occurred'
      
      if (options.errorRef) options.errorRef.value = message
      
      if (!options.silentErrors) {
        toast.add({
          title: t('common.error'),
          description: message,
          color: 'error'
        })
      }
      
      if (options.throwOnError) {
        throw err
      }
      
      return [err, null]
    } finally {
      if (options.loadingRef) options.loadingRef.value = false
    }
  }

  return { executeAction }
}
