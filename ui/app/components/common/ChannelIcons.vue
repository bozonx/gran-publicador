<script setup lang="ts">
interface SimpleChannel {
  id: string
  name: string
  socialMedia: string
  isStale?: boolean
}

interface Props {
  /** Array of channels to display */
  channels: SimpleChannel[]
  /** Maximum number of channels to show */
  maxVisible?: number
  /** Whether to show as stacked icons */
  stacked?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  maxVisible: 5,
  stacked: true,
})

const visibleChannels = computed(() => 
  props.channels.slice(0, props.maxVisible)
)

const remainingCount = computed(() => 
  Math.max(0, props.channels.length - props.maxVisible)
)

// Simple helper to get problem level for SimpleChannel
function getSimpleProblemLevel(channel: SimpleChannel): 'warning' | 'critical' | null {
  return null
}
</script>

<template>
  <div class="flex items-center gap-2">
    <div 
      class="flex"
      :class="stacked ? '-space-x-2' : 'gap-2'"
    >
      <CommonSocialIcon 
        v-for="channel in visibleChannels" 
        :key="channel.id"
        :platform="channel.socialMedia" 
        :show-background="true" 
        :is-stale="channel.isStale"
        :problem-level="getSimpleProblemLevel(channel)"
        :class="stacked ? 'ring-2 ring-white dark:ring-gray-800 scale-90' : ''"
      />
      <div 
        v-if="remainingCount > 0" 
        class="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[10px] font-bold text-gray-500"
        :class="stacked ? 'ring-2 ring-white dark:ring-gray-800' : ''"
      >
        +{{ remainingCount }}
      </div>
    </div>
  </div>
</template>
