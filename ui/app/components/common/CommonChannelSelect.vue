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
}

const props = withDefaults(defineProps<Props>(), {
  projectId: null,
  excludeIds: () => [],
  placeholder: undefined,
  disabled: false,
  size: 'md',
  multiple: false,
  extraOptions: () => []
})

// Correct way to handle multiple/single modelValue with defineModel
const modelValue = defineModel<string | string[] | null>({ default: null })

const { channels, fetchChannels, isLoading, getSocialMediaIcon, getSocialMediaColor } = useChannels()
const { t } = useI18n()

// Fetch channels when projectId changes or component mounted
watch(() => props.projectId, async (newId) => {
  await fetchChannels({ projectId: newId || undefined })
}, { immediate: true })

const filteredChannels = computed(() => {
  return channels.value.filter(c => !c.archivedAt && !props.excludeIds.includes(c.id))
})

const channelOptions = computed(() => {
  const options = filteredChannels.value.map(c => ({
    value: c.id,
    label: c.name,
    socialMedia: c.socialMedia
  }))
  return [...props.extraOptions, ...options]
})

const internalValue = computed({
  get: () => ((modelValue.value as string | string[] | undefined) || (props.multiple ? [] : undefined)) as string | string[] | null,
  set: (val) => {
    modelValue.value = val
  }
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
    :searchable="true"
    :search-attributes="['label']"
    class="w-full"
    v-bind="$attrs"
  >
    <template #leading>
      <slot name="leading">
        <UIcon name="i-heroicons-rss" class="w-4 h-4" />
      </slot>
    </template>

    <template #item-leading="{ item }">
      <UIcon 
        v-if="item.socialMedia"
        :name="getSocialMediaIcon(item.socialMedia as any)" 
        :class="getSocialMediaColor(item.socialMedia as any)"
        class="w-4 h-4"
      />
    </template>
    
    <!-- Custom display for selected items -->
    <template #default>
      <div v-if="multiple && Array.isArray(internalValue) && internalValue.length" class="flex items-center gap-1">
         <span>{{ t('common.selected', { count: internalValue.length }) }}</span>
      </div>
      <div v-else-if="!multiple && internalValue" class="flex items-center gap-2 overflow-hidden">
        <template v-if="typeof internalValue === 'string'">
          <template v-for="opt in [channelOptions.find(o => o.value === internalValue)]" :key="opt?.value">
            <UIcon 
              v-if="opt?.socialMedia"
              :name="getSocialMediaIcon(opt.socialMedia as any)" 
              :class="getSocialMediaColor(opt.socialMedia as any)"
              class="w-4 h-4 shrink-0"
            />
            <span class="truncate">{{ opt?.label }}</span>
          </template>
        </template>
      </div>
      <span v-else class="text-gray-400 dark:text-gray-500">
        {{ placeholder || (multiple ? t('publication.select_channels') : t('channel.select_channel')) }}
      </span>
    </template>
  </USelectMenu>
</template>
