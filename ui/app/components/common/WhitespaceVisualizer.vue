<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  text: string | null | undefined
}>()

const visualizedChunks = computed(() => {
  const str = props.text || ''
  if (!str) return []

  const result: { type: 'newline' | 'space' | 'text', content: string }[] = []
  const lines = str.split('\n')

  lines.forEach((line, lineIndex) => {
    const len = line.length
    
    // Find leading spaces for this line
    const leadingSpacesMatch = line.match(/^[ \t]+/)
    const leadingCount = leadingSpacesMatch ? leadingSpacesMatch[0].length : 0
    
    // Find trailing spaces for this line
    const trailingSpacesMatch = line.match(/[ \t]+$/)
    const trailingCount = trailingSpacesMatch ? trailingSpacesMatch[0].length : 0
    
    for (let i = 0; i < len; i++) {
        const char = line[i] as string
        const isLeading = i < leadingCount
        const isTrailing = i >= (len - trailingCount)
        
        if (char === ' ' || char === '\t') {
            if (isLeading || isTrailing) {
                result.push({ type: 'space', content: char === '\t' ? '⇥' : '·' })
            } else {
                result.push({ type: 'text', content: char })
            }
        } else {
            result.push({ type: 'text', content: char })
        }
    }

    if (lineIndex < lines.length - 1) {
      result.push({ type: 'newline', content: '↵' })
    }
  })

  return result
})
</script>

<template>
  <div 
    v-if="text"
    class="flex flex-wrap items-center gap-0.5 px-2 py-1 bg-gray-50 dark:bg-gray-900/50 rounded border border-gray-200 dark:border-gray-800 text-[10px] font-mono leading-none min-h-6"
  >
    <template v-for="(chunk, index) in visualizedChunks" :key="index">
      <span 
        v-if="chunk.type === 'newline'" 
        class="inline-flex items-center justify-center w-4 h-4 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 font-bold"
        :title="$t('common.newline')"
      >
        {{ chunk.content }}
      </span>
      <span 
        v-else-if="chunk.type === 'space'" 
        class="inline-flex items-center justify-center w-3 h-4 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold"
        :title="chunk.content === '⇥' ? 'Tab' : 'Space'"
      >
        {{ chunk.content }}
      </span>
      <span v-else class="text-gray-500 dark:text-gray-400 whitespace-pre">
        {{ chunk.content }}
      </span>
    </template>
  </div>
</template>
