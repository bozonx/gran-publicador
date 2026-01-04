<script setup lang="ts">
import { getSocialMediaColor, getSocialMediaIcon } from '~/utils/socialMedia'
import type { SocialMedia } from '~/types/socialMedia'

const props = defineProps<{
  platform: SocialMedia | string
  size?: string
  showBackground?: boolean
  isStale?: boolean
}>()

const iconName = computed(() => getSocialMediaIcon(props.platform))
const color = computed(() => getSocialMediaColor(props.platform))
</script>

<template>
  <div class="inline-flex shrink-0 relative">
    <div 
      v-if="showBackground"
      class="flex items-center justify-center rounded-md"
      :class="[size === 'sm' ? 'p-1' : 'p-1.5']"
      :style="{ backgroundColor: color + '20' }"
    >
      <UIcon 
        :name="iconName" 
        :class="[size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5']"
        :style="{ color: color }"
      ></UIcon>
    </div>
    <UIcon 
      v-else
      :name="iconName" 
      :class="[size === 'sm' ? 'w-4 h-4' : 'w-5 h-5']"
      :style="{ color: color }"
    ></UIcon>

    <!-- Stale Indicator Dot -->
    <div 
      v-if="isStale" 
      class="absolute -top-0.5 -right-0.5 bg-orange-500 border-2 border-white dark:border-gray-950 rounded-full"
      :class="[size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5']"
    ></div>
  </div>
</template>
