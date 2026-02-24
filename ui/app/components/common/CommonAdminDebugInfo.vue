<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'

interface Props {
  data: Record<string, any>
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end'
  excludeKeys?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  placement: 'bottom-end',
  excludeKeys: () => ['creator', 'project', 'media', 'posts', 'channels', 'user']
})

const { isSuperAdmin } = useAuth()
const isOpen = ref(false)

const cleanedData = computed(() => {
  if (!props.data) return {}
  
  const result: Record<string, any> = {}
  const keys = Object.keys(props.data).filter(key => !props.excludeKeys.includes(key))
  
  for (const key of keys) {
    const value = props.data[key]
    // Skip null/undefined or complex objects that were missed by excludeKeys
    if (value === null || value === undefined) continue
    if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 5) continue
    
    result[key] = value
  }
  
  return result
})

const hasData = computed(() => Object.keys(cleanedData.value).length > 0)
</script>

<template>
  <UPopover 
    v-if="isSuperAdmin && hasData" 
    v-model:open="isOpen" 
    mode="click" 
    :popper="{ placement }" 
    class="inline-flex items-center align-middle"
  >
    <button
      type="button"
      class="inline-flex items-center align-middle transition-opacity opacity-40 hover:opacity-100"
      title="Admin Debug Info"
      @mousedown.stop
      @click.stop
    >
      <UIcon
        name="i-heroicons-command-line"
        class="w-3.5 h-3.5 text-primary-500"
      />
    </button>
    
    <template #content>
      <div class="p-3 min-w-[240px] max-w-sm max-h-[400px] overflow-y-auto bg-gray-900 text-gray-100 rounded-lg shadow-xl border border-gray-700 font-mono text-[10px] leading-relaxed">
        <div class="flex items-center justify-between mb-2 pb-1 border-b border-gray-700">
          <span class="text-xs font-bold text-primary-400">DEBUG INFO</span>
          <UIcon name="i-heroicons-bug-ant" class="w-3 h-3 text-primary-400" />
        </div>
        
        <div class="space-y-1.5">
          <div v-for="(value, key) in cleanedData" :key="key" class="flex flex-col gap-0.5">
            <span class="text-gray-500">{{ key }}:</span>
            <div class="pl-2 break-all text-gray-200">
              <template v-if="typeof value === 'object'">
                <pre class="whitespace-pre-wrap text-[9px]">{{ JSON.stringify(value, null, 2) }}</pre>
              </template>
              <template v-else>
                {{ value }}
              </template>
            </div>
          </div>
        </div>
      </div>
    </template>
  </UPopover>
</template>
