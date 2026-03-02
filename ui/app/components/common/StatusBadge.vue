<script setup lang="ts">
import type { PublicationStatus } from '~/types/posts'

const props = defineProps<{
  /** Status string (e.g. DRAFT, READY, PUBLISHED) */
  status: string | PublicationStatus
  /** Optional size for the badge */
  size?: 'xs' | 'sm' | 'md' | 'lg'
  /** Optional variant for the badge */
  variant?: 'solid' | 'subtle' | 'soft' | 'outline'
}>()

const { t } = useI18n()
const { getStatusColor, getStatusDisplayName, getStatusIcon } = usePublications()
</script>

<template>
  <UBadge 
    :color="getStatusColor(status as string) as any" 
    :size="size || 'xs'" 
    :variant="variant || 'subtle'" 
    class="capitalize gap-1"
  >
    <UIcon 
      :name="getStatusIcon(status as string)" 
      class="w-3.5 h-3.5" 
      :class="{ 'animate-spin': status === 'PROCESSING' }" 
    />
    {{ getStatusDisplayName(status as string) }}
  </UBadge>
</template>
