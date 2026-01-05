<script setup lang="ts">
interface Props {
  /** Array of language codes */
  languages: string[]
  /** Display mode */
  mode?: 'compact' | 'normal'
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'normal',
})

const formattedLanguages = computed(() => 
  props.languages.map(lang => lang.split('-')[0])
)
</script>

<template>
  <div class="flex items-center gap-2">
    <UIcon name="i-heroicons-globe-alt" class="w-4 h-4 text-gray-400 shrink-0" />
    <div class="flex flex-wrap gap-1">
      <span 
        v-for="lang in formattedLanguages" 
        :key="lang"
        class="text-[10px] font-bold uppercase px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded"
      >
        {{ lang }}
      </span>
    </div>
  </div>
</template>
