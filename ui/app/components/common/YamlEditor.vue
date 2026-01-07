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

const displayValue = computed({
  get: () => {
    const val = props.modelValue
    if (!val || val === '{}' || (typeof val === 'string' && val.trim() === '')) {
      return ''
    }
    return val
  },
  set: (val: string) => {
    emit('update:modelValue', val)
  }
})
</script>

<template>
  <UFormField 
    :label="label" 
    :help="help || t('media.yamlHelp', 'Additional metadata in YAML format')"
    class="w-full"
  >
    <UTextarea
      v-model="displayValue"
      :rows="rows"
      :disabled="disabled"
      class="font-mono text-xs w-full"
      autoresize
    />
  </UFormField>
</template>
