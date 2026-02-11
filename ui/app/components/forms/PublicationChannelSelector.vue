<script setup lang="ts">
interface Props {
  modelValue: string[]
  channels: any[]
  currentLanguage: string
  disabled?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits(['update:modelValue'])

const selectedIds = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})
</script>

<template>
  <CommonChannelCheckboxList
    v-model="selectedIds"
    :channels="channels"
    :language="currentLanguage"
    :disabled="disabled"
  />
</template>
