<script setup lang="ts">
import { useChannels } from '~/composables/useChannels'
import type { ChannelWithProject } from '~/types/channels'

interface ChannelOption {
  value: string
  label: string
  socialMedia?: string
  [key: string]: any
}

interface Props {
  projectId?: string | null
  excludeIds?: string[]
  placeholder?: string
  disabled?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  multiple?: boolean
  extraOptions?: ChannelOption[]
  /** Whether to show an "All Channels" option and allow null value */
  allowAll?: boolean
  /** Label for the "All Channels" option */
  allLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  projectId: null,
  excludeIds: () => [],
  placeholder: undefined,
  disabled: false,
  size: 'md',
  multiple: false,
  extraOptions: () => [],
  allowAll: false,
  allLabel: undefined
})

// Correct way to handle multiple/single modelValue with defineModel
const modelValue = defineModel<string | string[] | null>({ default: null })

const { channels, fetchChannels, isLoading, getSocialMediaIcon, getSocialMediaColor } = useChannels()
const { t } = useI18n()

import { SELECT_ITEMS_LIMIT } from '~/constants'

// Fetch channels when projectId changes or component mounted
watch(() => props.projectId, async (newId) => {
  await fetchChannels({ projectId: newId || undefined, limit: SELECT_ITEMS_LIMIT })
}, { immediate: true })

const searchChannels = async (q: string) => {
  const result = await fetchChannels({ 
    projectId: props.projectId || undefined, 
    search: q,
    limit: SELECT_ITEMS_LIMIT
  })
  
  // Format them mapping to options format
  const mapped = result
    .filter(c => !c.archivedAt && !props.excludeIds.includes(c.id))
    .map(c => ({
      value: c.id,
      label: c.name,
      socialMedia: c.socialMedia
    }))
    
  return mapped
}

const filteredChannels = computed(() => {
  return channels.value.filter(c => !c.archivedAt && !props.excludeIds.includes(c.id))
})

const channelOptions = computed(() => {
  const options = filteredChannels.value.map(c => ({
    value: c.id,
    label: c.name,
    socialMedia: c.socialMedia
  }))
  
  const base = [...props.extraOptions, ...options]
  
  if (props.allowAll) {
    return [
      { value: null, label: props.allLabel || t('channel.allChannels') },
      ...base
    ]
  }
  
  return base
})

const internalValue = computed({
  get: () => ((modelValue.value as string | string[] | undefined) || (props.multiple ? [] : undefined)) as string | string[] | undefined,
  set: (val) => {
    modelValue.value = val || null
  }
})

const selectedSingleOption = computed(() => {
  if (props.multiple || typeof internalValue.value !== 'string') return null
  return (channelOptions.value as any[]).find(o => o.value === internalValue.value)
})

const currentLeadingIcon = computed(() => {
  if (selectedSingleOption.value?.socialMedia) {
    return getSocialMediaIcon(selectedSingleOption.value.socialMedia)
  }
  return 'i-heroicons-rss'
})

const currentLeadingIconColor = computed(() => {
  if (selectedSingleOption.value?.socialMedia) {
    return getSocialMediaColor(selectedSingleOption.value.socialMedia)
  }
  return ''
})
</script>

<template>
  <USelectMenu
    v-model="internalValue"
    :items="channelOptions"
    :multiple="multiple"
    value-key="value"
    label-key="label"
    :loading="isLoading"
    :disabled="disabled"
    :placeholder="placeholder || (multiple ? t('publication.select_channels') : t('channel.select_channel'))"
    :searchable="searchChannels"
    class="w-full"
    v-bind="$attrs"
  >
    <template #leading>
      <slot name="leading">
        <UIcon 
          :name="currentLeadingIcon" 
          :class="['w-4 h-4', currentLeadingIconColor]" 
        />
      </slot>
    </template>

    <template #item-leading="{ item }">
      <UIcon 
        v-if="(item as any).socialMedia"
        :name="getSocialMediaIcon((item as any).socialMedia)" 
        :class="getSocialMediaColor((item as any).socialMedia)"
        class="w-4 h-4"
      />
    </template>
    
    <!-- Custom display for selected items -->
    <template #default>
      <div v-if="multiple && Array.isArray(internalValue) && internalValue.length" class="flex items-center gap-1">
         <span>{{ t('common.selected', { count: internalValue.length }) }}</span>
      </div>
      <div v-else-if="!multiple && internalValue" class="flex items-center gap-2 overflow-hidden">
        <span class="truncate">{{ selectedSingleOption?.label }}</span>
      </div>
      <span v-else class="text-gray-400 dark:text-gray-500">
        {{ placeholder || (multiple ? t('publication.select_channels') : t('channel.select_channel')) }}
      </span>
    </template>
  </USelectMenu>
</template>
