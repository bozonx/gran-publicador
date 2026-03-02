<script setup lang="ts">
interface SimpleChannel {
  id: string
  name: string
  socialMedia: string
  isStale?: boolean
  [key: string]: unknown
}

interface Props {
  /** Array of channels to display */
  channels: SimpleChannel[]
  /** Maximum number of channels to show */
  maxVisible?: number
  /** Whether to show as stacked icons */
  stacked?: boolean
  /** Optional function to get problem level for a channel */
  getProblemLevel?: ((channel: SimpleChannel) => 'warning' | 'critical' | null) | undefined
  /** Optional prefix for routing to channel */
  routePrefix?: string
}

const props = withDefaults(defineProps<Props>(), {
  maxVisible: 5,
  stacked: true,
  getProblemLevel: undefined,
  routePrefix: '',
})

const visibleChannels = computed(() => 
  props.channels.slice(0, props.maxVisible)
)

const remainingCount = computed(() => 
  Math.max(0, props.channels.length - props.maxVisible)
)

function getSimpleProblemLevel(channel: SimpleChannel): 'warning' | 'critical' | null {
  if (props.getProblemLevel) {
    return props.getProblemLevel(channel)
  }
  return null
}
</script>

<template>
  <div class="flex items-center gap-2">
    <div 
      class="flex"
      :class="stacked ? '-space-x-2' : 'gap-2'"
    >
      <UTooltip 
        v-for="channel in visibleChannels" 
        :key="channel.id" 
        :text="channel.name"
      >
        <NuxtLink 
          v-if="routePrefix"
          :to="`${routePrefix}${channel.id}`"
          class="hover:opacity-80 transition-opacity block"
          @click.stop
        >
          <CommonSocialIcon 
            :platform="channel.socialMedia" 
            :show-background="true" 
            :is-stale="channel.isStale"
            :problem-level="getSimpleProblemLevel(channel)"
            :class="stacked ? 'ring-2 ring-white dark:ring-gray-800 scale-90' : ''"
          />
        </NuxtLink>
        <CommonSocialIcon 
          v-else
          :platform="channel.socialMedia" 
          :show-background="true" 
          :is-stale="channel.isStale"
          :problem-level="getSimpleProblemLevel(channel)"
          :class="stacked ? 'ring-2 ring-white dark:ring-gray-800 scale-90' : ''"
        />
      </UTooltip>
      <div 
        v-if="remainingCount > 0" 
        class="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xxs font-bold text-gray-500"
        :class="stacked ? 'ring-2 ring-white dark:ring-gray-800' : ''"
        :title="`+${remainingCount} more`"
      >
        +{{ remainingCount }}
      </div>
    </div>
  </div>
</template>
