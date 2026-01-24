<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  text: string
}

defineProps<Props>()

const open = ref(false)
</script>

<template>
  <UTooltip :text="text" v-model:open="open" :popper="{ placement: 'top' }">
    <UIcon
      name="i-heroicons-information-circle"
      class="w-4 h-4 text-gray-400 hover:text-gray-500 cursor-help"
      @click="open = true"
      @mouseenter="open = true"
      @mouseleave="open = false"
    />
  </UTooltip>
</template>
