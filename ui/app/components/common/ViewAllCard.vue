<script setup lang="ts">
interface Props {
  to: string
  label?: string
}

const props = withDefaults(defineProps<Props>(), {
  label: ''
})

const { t } = useI18n()
const displayLabel = computed(() => props.label || t('common.viewAll', 'View All'))
</script>

<template>
  <NuxtLink
    :to="props.to"
    class="shrink-0 w-48 h-48 sm:w-64 sm:h-auto min-h-[160px] border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg flex flex-col items-center justify-center gap-3 transition-all hover:border-primary-500 dark:hover:border-primary-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 group"
  >
    <div class="p-3 rounded-full bg-gray-100 dark:bg-gray-800 group-hover:bg-primary-50 dark:group-hover:bg-primary-900/30 transition-colors">
      <UIcon 
        name="i-heroicons-arrow-right" 
        class="w-6 h-6 text-gray-400 group-hover:text-primary-500 dark:group-hover:text-primary-400" 
      />
    </div>
    <span class="text-sm font-medium text-gray-600 dark:text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400">
      {{ displayLabel }}
    </span>
  </NuxtLink>
</template>
