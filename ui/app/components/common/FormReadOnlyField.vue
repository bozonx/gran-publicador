<script setup lang="ts">
interface Props {
  /** Field label */
  label: string
  /** Field value */
  value: string | number | null | undefined
  /** Help text */
  help?: string
  /** Icon name */
  icon?: string
  /** Whether to format as date */
  formatAsDate?: boolean
  /** Whether to use monospace font */
  mono?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  help: undefined,
  icon: undefined,
  formatAsDate: false,
  mono: false,
})

const { d } = useI18n()

const displayValue = computed(() => {
  if (props.value === null || props.value === undefined) return '—'
  
  if (props.formatAsDate && typeof props.value === 'string') {
    return d(new Date(props.value), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  
  return String(props.value)
})
</script>

<template>
  <div class="space-y-2">
    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
      {{ label }}
    </label>
    <div class="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
      <div class="flex items-center gap-2">
        <UIcon v-if="icon" :name="icon" class="w-5 h-5 text-gray-500 shrink-0" />
        <span 
          class="text-gray-900 dark:text-white"
          :class="{ 'font-mono': mono, 'font-medium': !mono }"
        >
          {{ displayValue }}
        </span>
      </div>
    </div>
    <p v-if="help" class="text-xs text-gray-500 dark:text-gray-400">
      {{ help }}
    </p>
  </div>
</template>
