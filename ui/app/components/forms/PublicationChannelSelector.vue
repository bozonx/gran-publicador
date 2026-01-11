<script setup lang="ts">
import { GRID_LAYOUTS } from '~/utils/design-tokens'
import SocialIcon from '~/components/common/SocialIcon.vue'

interface Props {
  modelValue: string[]
  channels: any[]
  currentLanguage: string
  disabled?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

const channelOptions = computed(() => {
  return props.channels.map((channel: any) => ({
    value: channel.id,
    label: channel.name,
    socialMedia: channel.socialMedia,
    language: channel.language,
    isActive: channel.isActive,
    archivedAt: channel.archivedAt,
    isDisabled: !channel.isActive || !!channel.archivedAt || props.disabled,
  }))
})

function toggleChannel(channelId: string) {
  const newValue = [...props.modelValue]
  const index = newValue.indexOf(channelId)
  if (index === -1) {
    newValue.push(channelId)
  } else {
    newValue.splice(index, 1)
  }
  emit('update:modelValue', newValue)
}
</script>

<template>
  <div v-if="channelOptions.length > 0" :class="[GRID_LAYOUTS.channelGrid, 'mt-2']">
    <div 
      v-for="channel in channelOptions" 
      :key="channel.value" 
      :class="[
        'flex items-center justify-between p-3 border rounded-lg transition-colors',
        channel.isDisabled 
          ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 opacity-60 cursor-not-allowed' 
          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer'
      ]"
      @click="!channel.isDisabled && toggleChannel(channel.value)"
    >
      <div class="flex items-center gap-2">
        <UCheckbox 
          :model-value="modelValue.includes(channel.value)"
          :disabled="channel.isDisabled"
          @update:model-value="!channel.isDisabled && toggleChannel(channel.value)"
          class="pointer-events-none" 
        />
        <span :class="[
          'text-sm font-medium truncate max-w-32',
          channel.isDisabled ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'
        ]">
          {{ channel.label }}
        </span>
      </div>
      
      <div class="flex items-center gap-1.5 shrink-0 ml-2">
        <UTooltip v-if="!channel.isActive" :text="t('channel.inactiveTooltip')">
          <UBadge color="warning" variant="subtle" size="xs">
            {{ t('channel.inactive') }}
          </UBadge>
        </UTooltip>
        
        <UTooltip v-if="channel.archivedAt" :text="t('channel.archivedTooltip')">
          <UBadge color="neutral" variant="subtle" size="xs">
            {{ t('common.archived') }}
          </UBadge>
        </UTooltip>
        
        <span class="text-xxs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded flex items-center gap-1 font-mono uppercase">
          <UIcon name="i-heroicons-language" class="w-3 h-3" />
          {{ channel.language }}
        </span>
        
        <UTooltip v-if="channel.language !== currentLanguage" :text="t('publication.languageMismatch', { lang: currentLanguage })">
          <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4 text-amber-500" />
        </UTooltip>
        
        <UTooltip :text="channel.socialMedia">
          <SocialIcon :platform="channel.socialMedia" size="sm" />
        </UTooltip>
      </div>
    </div>
  </div>
  <div v-else class="text-sm text-gray-500 dark:text-gray-400 italic">
    {{ t('publication.noChannels') }}
  </div>
</template>
