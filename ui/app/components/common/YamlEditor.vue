<script setup lang="ts">
import yaml from 'js-yaml'

interface Props {
  modelValue: string
  disabled?: boolean
  label?: string
  help?: string
  rows?: number
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  rows: 8,
  label: 'Meta (YAML)',
  help: ''
})

const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

// Validation state
const validationError = ref<string | undefined>(undefined)

const displayValue = computed({
  get: () => {
    const val = props.modelValue
    // Don't show '{}' for empty objects
    if (!val || val.trim() === '' || val.trim() === '{}') {
      return ''
    }
    return val
  },
  set: (val: string) => {
    // Validate YAML on input
    if (val && val.trim() !== '') {
      try {
        const parsed = yaml.load(val)
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          validationError.value = t('validation.invalidYaml', 'Must be a valid YAML object (key-value pairs), not a list or value')
        } else {
          validationError.value = undefined
        }
      } catch (e: any) {
        validationError.value = e.message || t('validation.invalidYaml', 'Invalid YAML syntax')
      }
    } else {
      validationError.value = undefined
    }
    
    emit('update:modelValue', val)
  }
})
</script>

<template>
  <UFormField 
    :label="label" 
    :error="validationError"
    class="w-full"
  >
    <template #help>
      <div class="flex items-center justify-between w-full">
        <span class="text-sm text-gray-500 dark:text-gray-400">
          {{ help || t('media.yamlHelp', 'Additional metadata in YAML format') }}
        </span>
        <slot name="actions" />
      </div>
    </template>
    <UTextarea
      v-model="displayValue"
      :rows="rows"
      :disabled="disabled"
      class="font-mono text-xs w-full"
      autoresize
    />
  </UFormField>
</template>
