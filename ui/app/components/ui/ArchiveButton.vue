<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ArchiveEntityType } from '~/types/archive.types'

interface Props {
  // Type of entity (PROJECT, CHANNEL, PUBLICATION)
  entityType: ArchiveEntityType
  
  // Entity ID
  entityId: string
  
  // Is entity currently archived?
  isArchived: boolean
  
  // Loading state
  loading?: boolean
  
  // Button size
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  
  // Button variant
  variant?: 'solid' | 'soft' | 'ghost' | 'outline'
  
  // Show label or icon only
  showLabel?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  size: 'sm',
  variant: 'soft',
  showLabel: true
})

const emit = defineEmits<{
  toggle: []
}>()

const { t } = useI18n()
const { archiveEntity, restoreEntity } = useArchive()

const isProcessing = ref(false)

const buttonConfig = computed(() => {
  if (props.isArchived) {
    return {
      label: t('common.restore'),
      icon: 'i-heroicons-archive-box-arrow-down',
      color: 'warning' as const
    }
  } else {
    return {
      label: t('common.archive'),
      icon: 'i-heroicons-archive-box',
      color: 'neutral' as const
    }
  }
})

async function handleToggle() {
  isProcessing.value = true
  
  try {
    if (props.isArchived) {
      await restoreEntity(props.entityType, props.entityId)
    } else {
      await archiveEntity(props.entityType, props.entityId)
    }
    
    // Emit toggle event so parent can refresh data
    emit('toggle')
  } catch (error) {
    console.error('[ArchiveButton] Error toggling archive:', error)
  } finally {
    isProcessing.value = false
  }
}

const isLoading = computed(() => props.loading || isProcessing.value)
</script>

<template>
  <UButton
    :label="showLabel ? buttonConfig.label : undefined"
    :icon="buttonConfig.icon"
    :color="buttonConfig.color"
    :variant="variant"
    :size="size"
    :loading="isLoading"
    @click="handleToggle"
  />
</template>
