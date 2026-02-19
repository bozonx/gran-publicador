<script setup lang="ts">
import { watch, onBeforeUnmount, ref } from 'vue'

interface Props {
  preventClose?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  preventClose: false,
})

const isOpen = defineModel<boolean>('open', { default: false })

watch(
  isOpen,
  (value) => {
    if (!import.meta.client) return
    if (value) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  },
  { immediate: true },
)

const containerEl = ref<HTMLDivElement | null>(null)

defineExpose({ containerEl })

onBeforeUnmount(() => {
  if (!import.meta.client) return
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" ref="containerEl" class="fixed inset-0 z-60 pointer-events-auto">
      <div class="absolute inset-0 bg-gray-950">
        <slot />
      </div>
    </div>
  </Teleport>
</template>
