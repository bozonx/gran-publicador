<script setup lang="ts">
import { watch, onBeforeUnmount } from 'vue'

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

onBeforeUnmount(() => {
  if (!import.meta.client) return
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-60">
      <div class="absolute inset-0 bg-black/60 pointer-events-none" role="presentation"></div>
      <div class="absolute inset-0 bg-gray-950 pointer-events-auto">
        <slot />
      </div>
    </div>
  </Teleport>
</template>
