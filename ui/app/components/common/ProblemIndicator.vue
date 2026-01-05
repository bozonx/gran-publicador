<script setup lang="ts">
const props = defineProps<{
  problems: Array<{ type: 'critical' | 'warning', key: string, count?: number }>
  entityType: 'publication' | 'channel' | 'project'
  size?: 'sm' | 'md' | 'lg'
  showCount?: boolean
}>()

const { t } = useI18n()

const criticalCount = computed(() => 
  props.problems.filter(p => p.type === 'critical').length
)

const warningCount = computed(() => 
  props.problems.filter(p => p.type === 'warning').length
)

const hasCritical = computed(() => criticalCount.value > 0)
const hasWarning = computed(() => warningCount.value > 0)

const iconSize = computed(() => {
  switch (props.size) {
    case 'sm': return 'w-3.5 h-3.5'
    case 'lg': return 'w-5 h-5'
    default: return 'w-4 h-4'
  }
})

const tooltipText = computed(() => {
  const texts: string[] = []
  
  props.problems.forEach(problem => {
    const key = `problems.${props.entityType}.${problem.key}`
    const text = problem.count 
      ? t(key, { count: problem.count })
      : t(key)
    texts.push(text)
  })
  
  return texts.join('\n')
})
</script>

<template>
  <div v-if="problems.length > 0" class="flex items-center gap-1.5">
    <Transition
      mode="out-in"
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="transform scale-90 opacity-0"
      enter-to-class="transform scale-100 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="transform scale-100 opacity-100"
      leave-to-class="transform scale-90 opacity-0"
    >
      <!-- Critical indicator -->
      <UTooltip v-if="hasCritical" key="critical" :text="tooltipText">
        <div class="flex items-center gap-1">
          <UIcon 
            name="i-heroicons-x-circle" 
            class="text-red-500"
            :class="iconSize"
          />
          <span v-if="showCount && criticalCount > 1" class="text-xs text-red-600 dark:text-red-400 font-medium">
            {{ criticalCount }}
          </span>
        </div>
      </UTooltip>

      <!-- Warning indicator -->
      <UTooltip v-else-if="hasWarning" key="warning" :text="tooltipText">
        <div class="flex items-center gap-1">
          <UIcon 
            name="i-heroicons-exclamation-triangle" 
            class="text-orange-500"
            :class="iconSize"
          />
          <span v-if="showCount && warningCount > 1" class="text-xs text-orange-600 dark:text-orange-400 font-medium">
            {{ warningCount }}
          </span>
        </div>
      </UTooltip>
    </Transition>
  </div>
</template>
