<script setup lang="ts">
const { t } = useI18n()

const props = withDefaults(defineProps<{
  modelValue?: string
  placeholder?: string
  loading?: boolean
  disabled?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
}>(), {
  modelValue: '',
  placeholder: '',
  loading: false,
  disabled: false,
  size: 'md'
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const value = computed({
  get: () => props.modelValue ?? '',
  set: (val) => emit('update:modelValue', val)
})

function clear() {
  value.value = ''
}
defineOptions({
  inheritAttrs: false
})
</script>

<template>
  <UInput
    v-bind="$attrs"
    v-model="value"
    :placeholder="placeholder || t('common.search')"
    :disabled="disabled"
    :size="size"
    class="w-full"
  >
    <template #leading>
      <UIcon 
        v-if="loading" 
        name="i-heroicons-arrow-path" 
        class="animate-spin text-gray-400"
      />
      <UIcon 
        v-else 
        name="i-heroicons-magnifying-glass" 
        class="text-gray-400"
      />
    </template>

    <template v-if="modelValue" #trailing>
      <UButton
        color="neutral"
        variant="link"
        icon="i-heroicons-x-mark"
        :padded="false"
        :title="t('common.clear')"
        @click="clear"
      />
    </template>
  </UInput>
</template>
