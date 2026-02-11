<script setup lang="ts">
import { useChannels } from '~/composables/useChannels'
import type { SocialMedia } from '~/types/socialMedia'

interface Props {
  /** Placeholder when no value is selected */
  placeholder?: string
  /** Accessible title for the select */
  title?: string
  /** Whether the select is disabled */
  disabled?: boolean
  /** Size variant */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  /** Whether to show an "All social media" option */
  allowAll?: boolean
  /** Label for the "All social media" option */
  allLabel?: string
  /** Icon to use when nothing is selected. Defaults to i-heroicons-share */
  leadingIcon?: string
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: undefined,
  title: undefined,
  disabled: false,
  size: 'md',
  allowAll: false,
  allLabel: undefined,
  leadingIcon: 'i-heroicons-share',
})

const modelValue = defineModel<any>({ default: null })

const { t } = useI18n()
const { socialMediaOptions, getSocialMediaIcon } = useChannels()

const options = computed(() => {
  if (!props.allowAll) return socialMediaOptions.value
  
  return [
    { value: null, label: props.allLabel || t('publication.filter.allSocialMedia') },
    ...socialMediaOptions.value
  ]
})

const selectedOption = computed(() => {
  return options.value.find(opt => opt.value === modelValue.value)
})

const currentIcon = computed(() => {
  if (modelValue.value) {
    return getSocialMediaIcon(modelValue.value as SocialMedia)
  }
  return props.leadingIcon
})

const currentIconColor = computed(() => {
  if (modelValue.value) {
    return getSocialMediaColor(modelValue.value as SocialMedia)
  }
  return ''
})
</script>

<template>
  <USelectMenu
    v-model="modelValue"
    :items="options"
    value-key="value"
    label-key="label"
    :disabled="disabled"
    :size="size"
    :placeholder="placeholder || t('publication.filter.socialMedia')"
    :title="title || t('publication.filter.socialMediaTitle')"
    class="w-full"
    v-bind="$attrs"
  >
    <template #leading>
      <UIcon :name="currentIcon" :class="['w-4 h-4', currentIconColor]" />
    </template>

    <template #default>
      <span v-if="selectedOption && modelValue" class="truncate">
        {{ selectedOption.label }}
      </span>
      <span v-else-if="selectedOption" class="truncate">
        {{ selectedOption.label }}
      </span>
      <span v-else class="text-gray-400 truncate">
        {{ placeholder || t('common.select') }}
      </span>
    </template>

    <template #item-leading="{ item }">
      <UIcon v-if="item.value" :name="getSocialMediaIcon(item.value)" class="w-4 h-4" />
      <UIcon v-else :name="leadingIcon" class="w-4 h-4" />
    </template>
  </USelectMenu>
</template>
