import { ref, computed, watch, onMounted } from 'vue'

export interface SortOption {
    id: string
    label: string
    icon: string
}

export interface UseSortingOptions<T> {
    storageKey: string
    defaultSortBy: string
    defaultSortOrder?: 'asc' | 'desc'
    sortOptions: SortOption[]
    sortFn: (list: T[], sortBy: string, sortOrder: 'asc' | 'desc') => T[]
}

export function useSorting<T>(options: UseSortingOptions<T>) {
    const { storageKey, defaultSortBy, defaultSortOrder = 'asc', sortOptions, sortFn } = options

    const sortBy = ref(defaultSortBy)
    const sortOrder = ref<'asc' | 'desc'>(defaultSortOrder)

    const initSorting = () => {
        if (process.client) {
            const storedSortBy = localStorage.getItem(`${storageKey}-sort-by`)
            const storedSortOrder = localStorage.getItem(`${storageKey}-sort-order`)

            if (storedSortBy) sortBy.value = storedSortBy
            if (storedSortOrder && (storedSortOrder === 'asc' || storedSortOrder === 'desc')) {
                sortOrder.value = storedSortOrder as 'asc' | 'desc'
            }
        }
    }

    onMounted(() => {
        initSorting()
    })

    watch(sortBy, (val) => {
        if (process.client) localStorage.setItem(`${storageKey}-sort-by`, val)
    })

    watch(sortOrder, (val) => {
        if (process.client) localStorage.setItem(`${storageKey}-sort-order`, val)
    })

    const currentSortOption = computed(() => sortOptions.find(opt => opt.id === sortBy.value))

    const sortList = (list: T[]) => {
        return sortFn(list, sortBy.value, sortOrder.value)
    }

    const toggleSortOrder = () => {
        sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
    }

    return {
        sortBy,
        sortOrder,
        sortOptions,
        currentSortOption,
        sortList,
        toggleSortOrder
    }
}
