<template>
  <div :class="cardClasses">
    <div v-if="$slots.header || title" class="px-6 py-4 border-b border-gray-200">
      <slot name="header">
        <h3 class="text-lg font-semibold text-gray-900">
          {{ title }}
        </h3>
      </slot>
    </div>

    <div :class="bodyClasses">
      <slot />
    </div>

    <div v-if="$slots.footer" class="px-6 py-4 border-t border-gray-200 bg-gray-50">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  title?: string
  variant?: 'default' | 'bordered' | 'elevated'
  padding?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  padding: true,
})

const cardClasses = computed(() => {
  const baseClasses = 'bg-white rounded-telegram overflow-hidden'

  const variantClasses = {
    default: 'border border-gray-200',
    bordered: 'border-2 border-gray-300',
    elevated: 'shadow-lg',
  }

  return [baseClasses, variantClasses[props.variant]].join(' ')
})

const bodyClasses = computed(() => {
  return props.padding ? 'px-6 py-4' : ''
})
</script>
