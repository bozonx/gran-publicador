<script setup lang="ts">
import yaml from 'js-yaml'

interface Props {
  modelValue: string
  disabled?: boolean
  label?: string
  rows?: number
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  rows: 6
})

const emit = defineEmits(['update:modelValue'])

const displayValue = computed({
  get: () => {
    if (props.modelValue === '{}' || props.modelValue.trim() === '') {
      return ''
    }
    return props.modelValue
  },
  set: (val: string) => {
    emit('update:modelValue', val)
  }
})
</script>

<template>
  <div class="w-full">
    <UFormGroup v-if="label" :label="label" class="mb-2">
      <UTextarea
        v-model="displayValue"
        :rows="rows"
        :disabled="disabled"
        class="font-mono text-xs w-full"
        autoresize
      />
    </UFormGroup>
    <UTextarea
      v-else
      v-model="displayValue"
      :rows="rows"
      :disabled="disabled"
      class="font-mono text-xs w-full"
      autoresize
    />
  </div>
</template>
