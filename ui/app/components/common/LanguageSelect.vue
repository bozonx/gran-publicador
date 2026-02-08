<script setup lang="ts">
const props = defineProps<{
  modelValue: string | null | undefined
  /**
   * Selection mode: 
   * 'all' - all supported content languages
   * 'ui' - only languages available for the interface
   */
  mode?: 'all' | 'ui'
  placeholder?: string
  disabled?: boolean
  variant?: 'outline' | 'ghost' | 'subtle' | 'soft'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  searchable?: boolean
  allowAll?: boolean
  allLabel?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: any]
}>()

const { t } = useI18n()
const { locales } = useI18n()
const { languageOptions: allLanguageOptions } = useLanguages()

const options = computed(() => {
  let baseOptions = []
  if (props.mode === 'ui') {
    baseOptions = (locales.value as any[]).map((l: any) => ({
      value: l.code,
      label: l.name,
      icon: 'i-heroicons-language'
    }))
  } else {
    baseOptions = allLanguageOptions
  }

  if (props.allowAll) {
    return [
      { 
        value: null, 
        label: props.allLabel || t('common.all', 'All'), 
        icon: 'i-heroicons-globe-alt' 
      },
      ...baseOptions
    ]
  }
  
  return baseOptions
})

const internalValue = computed({
  get: () => {
    if (props.mode === 'ui' && props.modelValue) {
      const exists = options.value.some(o => o.value === props.modelValue)
      if (!exists) return 'en-US'
    }
    return props.modelValue as string | null
  },
  set: (val) => emit('update:modelValue', val)
})
</script>

<template>
  <USelectMenu
    v-model="internalValue"
    :items="options"
    value-key="value"
    label-key="label"
    :disabled="disabled"
    :variant="variant"
    :size="size"
    :searchable="searchable"
    class="w-full"
    :placeholder="placeholder"
  >
    <template #default="{ open }">
      <UButton
        v-bind="$attrs"
        color="neutral"
        :variant="variant || 'outline'"
        :size="size"
        :disabled="disabled"
        class="w-full justify-between"
        :icon="options.find(o => o.value === internalValue)?.icon || 'i-heroicons-language'"
        :trailing-icon="open ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
      >
        <span class="truncate">
          {{ options.find(o => o.value === internalValue)?.label || placeholder || t('common.language') }}
        </span>
      </UButton>
    </template>
  </USelectMenu>
</template>
