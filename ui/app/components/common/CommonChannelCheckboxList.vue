<script setup lang="ts">
import { useChannels } from '~/composables/useChannels'
import { GRID_LAYOUTS } from '~/utils/design-tokens'
import type { Channel } from '~/types/channels'
import type { ProjectAuthorSignature } from '~/types/author-signatures'

interface Props {
  projectId?: string | null
  language?: string | null
  channels?: Channel[]
  disabled?: boolean
  loading?: boolean
  /** Currently selected project template ID */
  selectedTemplateId?: string | null
  /** Author signatures available for the project */
  authorSignatures?: ProjectAuthorSignature[]
}

const props = withDefaults(defineProps<Props>(), {
  projectId: null,
  language: null,
  channels: undefined,
  disabled: false,
  loading: false,
  selectedTemplateId: null,
  authorSignatures: () => [],
})

const modelValue = defineModel<string[]>({ default: () => [] })

const { t } = useI18n()
const { 
  channels: fetchedChannels, 
  fetchChannels, 
  isLoading: isFetching, 
  getSocialMediaIcon, 
  getSocialMediaColor 
} = useChannels()

// Use provided channels or fetched ones
const allChannels = computed(() => props.channels !== undefined ? props.channels : fetchedChannels.value)
const isLoading = computed(() => props.loading || (props.channels === undefined && isFetching.value))

// Fetch if projectId or language changes
watch(
  [() => props.projectId, () => props.language],
  async ([newProj, newLang], _old, onInvalidate) => {
    if (props.channels !== undefined) return

    let cancelled = false
    onInvalidate(() => {
      cancelled = true
    })

    if (!newProj) {
      fetchedChannels.value = []
      return
    }

    await fetchChannels({
      projectId: newProj || undefined,
      language: newLang || undefined,
    })

    if (cancelled) return
  },
  { immediate: true },
)

const channelOptions = computed(() => {
  let list = allChannels.value

  if (props.language) {
    list = list.filter(c => c.language === props.language)
  }

  return list.map(c => ({
    value: c.id,
    label: c.name,
    language: c.language,
    socialMedia: c.socialMedia,
    isActive: c.isActive,
    archivedAt: c.archivedAt,
    preferences: (c as Channel).preferences,
    isDisabled: !c.isActive || !!c.archivedAt || props.disabled
  }))
})

interface ChannelWarning {
  type: 'templateExcluded' | 'noSignatureVariant'
  message: string
}

const channelWarnings = computed(() => {
  const warnings = new Map<string, ChannelWarning[]>()

  for (const ch of channelOptions.value) {
    const chWarnings: ChannelWarning[] = []

    // Check if selected template is excluded for this channel
    if (props.selectedTemplateId && ch.preferences?.templates) {
      const variation = ch.preferences.templates.find(
        v => v.projectTemplateId === props.selectedTemplateId
      )
      if (variation?.excluded) {
        chWarnings.push({
          type: 'templateExcluded',
          message: t('channel.warnings.templateExcluded'),
        })
      }
    }

    // Check if any selected signature has a variant for this channel's language
    if (props.authorSignatures.length > 0 && ch.language) {
      const hasVariant = props.authorSignatures.some(sig =>
        sig.variants.some(v => v.language === ch.language)
      )
      if (!hasVariant) {
        chWarnings.push({
          type: 'noSignatureVariant',
          message: t('channel.warnings.noSignatureVariant'),
        })
      }
    }

    if (chWarnings.length > 0) {
      warnings.set(ch.value, chWarnings)
    }
  }

  return warnings
})

function toggleChannel(channelId: string) {
  const newValue = [...modelValue.value]
  const index = newValue.indexOf(channelId)
  if (index === -1) {
    newValue.push(channelId)
  } else {
    newValue.splice(index, 1)
  }
  modelValue.value = newValue
}
</script>

<template>
  <div v-if="isLoading" class="flex justify-center p-4">
    <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin text-gray-400" />
  </div>
  
  <div v-else-if="channelOptions.length > 0" :class="[GRID_LAYOUTS.channelGrid || 'grid grid-cols-1 gap-3', 'mt-2']">
    <div 
      v-for="channel in channelOptions" 
      :key="channel.value" 
      :class="[
        'p-3 border rounded-lg transition-colors',
        channel.isDisabled 
          ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 opacity-60 cursor-not-allowed' 
          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer'
      ]"
      @click="!channel.isDisabled && toggleChannel(channel.value)"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2 overflow-hidden">
          <UCheckbox 
            :model-value="modelValue.includes(channel.value)"
            :disabled="channel.isDisabled"
            class="pointer-events-none"
            @update:model-value="!channel.isDisabled && toggleChannel(channel.value)" 
          />
          <span
            :class="[
              'text-sm font-medium truncate',
              channel.isDisabled ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'
            ]"
          >
            {{ channel.label }}
          </span>
        </div>
        
        <div class="flex items-center gap-1.5 shrink-0 ml-2">
          <UTooltip 
            v-for="warning in (channelWarnings.get(channel.value) || [])" 
            :key="warning.type" 
            :text="warning.message"
          >
            <UIcon 
              name="i-heroicons-exclamation-triangle" 
              class="w-4 h-4 text-amber-500"
            />
          </UTooltip>

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
          
          <UTooltip :text="channel.socialMedia">
            <UIcon 
              :name="getSocialMediaIcon(channel.socialMedia as any)" 
              :class="getSocialMediaColor(channel.socialMedia as any)"
              class="w-4 h-4"
            />
          </UTooltip>
        </div>
      </div>

      <!-- Warning messages below channel name -->
      <div 
        v-if="channelWarnings.has(channel.value)" 
        class="mt-1.5 ml-7 flex flex-col gap-0.5"
      >
        <span 
          v-for="warning in channelWarnings.get(channel.value)" 
          :key="warning.type"
          class="text-xs text-amber-600 dark:text-amber-400"
        >
          {{ warning.message }}
        </span>
      </div>
    </div>
  </div>
  
  <div v-else class="text-sm text-gray-500 dark:text-gray-400 italic py-2">
    {{ t('publication.noChannels') }}
  </div>
</template>
