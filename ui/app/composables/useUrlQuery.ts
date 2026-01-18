import { ref, watch, onMounted, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

interface UrlQueryOptions<T> {
  name: string
  defaultValue: T
  serialize?: (value: T) => string | undefined
  deserialize?: (value: string) => T
}

/**
 * Composable to sync ref state with URL query parameters
 */
export function useUrlQuery<T>(options: UrlQueryOptions<T>) {
  const route = useRoute()
  const router = useRouter()
  const { name, defaultValue, serialize, deserialize } = options

  const state = ref<T>(defaultValue) as Ref<T>

  // Initialize from URL
  const initFromUrl = () => {
    const value = route.query[name]
    if (value !== undefined) {
      if (deserialize) {
        state.value = deserialize(value as string)
      } else {
        state.value = value as unknown as T
      }
    }
  }

  // Update URL when state changes
  watch(state, (newValue) => {
    const query = { ...route.query }
    const serialized = serialize ? serialize(newValue) : String(newValue)

    if (newValue === defaultValue || serialized === undefined || serialized === '') {
      delete query[name]
    } else {
      query[name] = serialized
    }

    // Don't push to history for every filter change, use replace
    router.replace({ query })
  })

  // Watch for external URL changes (e.g. back button)
  watch(() => route.query[name], (newVal) => {
    if (newVal === undefined) {
      state.value = defaultValue
    } else {
      const currentSerial = serialize ? serialize(state.value) : String(state.value)
      if (newVal !== currentSerial) {
        state.value = deserialize ? deserialize(newVal as string) : (newVal as unknown as T)
      }
    }
  })

  onMounted(() => {
    initFromUrl()
  })

  return state
}

/**
 * Helper for multiple filters sync
 */
export function useUrlFilters<T extends Record<string, any>>(configs: { [K in keyof T]: Omit<UrlQueryOptions<T[K]>, 'name'> }) {
  const filters = {} as { [K in keyof T]: Ref<T[K]> }
  
  for (const key in configs) {
    const name = key as string
    filters[key] = useUrlQuery({
      name,
      ...configs[key]
    })
  }
  
  return filters
}
