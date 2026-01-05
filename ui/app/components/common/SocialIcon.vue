<script setup lang="ts">
import { getSocialMediaColor, getSocialMediaIcon } from '~/utils/socialMedia'
import type { SocialMedia } from '~/types/socialMedia'

const props = defineProps<{
  platform: SocialMedia | string
  size?: string
  showBackground?: boolean
  isStale?: boolean
  problemLevel?: 'critical' | 'warning' | null
}>()

const iconName = computed(() => getSocialMediaIcon(props.platform))
const color = computed(() => getSocialMediaColor(props.platform))

// Determine indicator color and visibility
const showIndicator = computed(() => props.problemLevel || props.isStale)
const indicatorColor = computed(() => {
  if (props.problemLevel === 'critical') return 'bg-red-500'
  if (props.problemLevel === 'warning') return 'bg-orange-500'
  if (props.isStale) return 'bg-orange-500'
  return 'bg-orange-500'
})
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

    <!-- Problem/Stale Indicator Dot -->
    <div 
      v-if="showIndicator" 
      class="absolute -top-0.5 -right-0.5 border-2 border-white dark:border-gray-950 rounded-full"
      :class="[
        indicatorColor,
        size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'
      ]"
    ></div>
  </div>
</template>
