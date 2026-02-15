<script setup lang="ts">
/**
 * HexColorPicker - A common component for selecting and inputting HEX colors
 * Features:
 * - Visual '#' prefix
 * - Automatic '#' stripping/adding
 * - Integrated UColorPicker in a Popover
 * - Color preview
 */

interface Props {
  modelValue: string
  disabled?: boolean
  placeholder?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: 'ffffff'
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

// Internal display value without '#'
const displayValue = computed({
  get: () => props.modelValue.startsWith('#') ? props.modelValue.slice(1) : props.modelValue,
  set: (val) => {
    let normalized = val.trim()
    // Strip any '#' if the user typed it anyway
    if (normalized.startsWith('#')) {
      normalized = normalized.slice(1)
    }
    // Only emit '#' + value if not empty, otherwise empty string
    emit('update:modelValue', normalized ? '#' + normalized : '')
  }
})

// Validation for preview
const isValidHex = computed(() => {
  return /^#([0-9A-F]{3}){1,2}$/i.test(props.modelValue)
})

// Effective color for styles
const effectiveColor = computed(() => {
  if (!props.modelValue) return 'transparent'
  return props.modelValue.startsWith('#') ? props.modelValue : '#' + props.modelValue
})

function onPickerUpdate(val: string) {
  emit('update:modelValue', val)
}
</script>

<template>
  <div class="flex gap-2 items-center">
    <UInput
      v-model="displayValue"
      :disabled="disabled"
      :placeholder="placeholder"
      class="flex-1"
    >
      <template #leading>
        <span class="text-gray-400 dark:text-gray-500 font-mono">#</span>
      </template>

      <template #trailing>
        <UPopover :disabled="disabled" :popper="{ placement: 'bottom-end' }">
          <UButton
            variant="ghost"
            class="p-1 min-h-0 aspect-square"
            :disabled="disabled"
            aria-label="Pick color"
          >
            <div 
              class="w-5 h-5 rounded border border-gray-200 dark:border-gray-700 shadow-sm"
              :style="{ backgroundColor: effectiveColor }"
              :class="!modelValue ? 'bg-transparent border-dashed' : ''"
            >
              <UIcon 
                v-if="!modelValue" 
                name="i-heroicons-swatch" 
                class="w-full h-full text-gray-400 p-0.5" 
              />
            </div>
          </UButton>

          <template #content>
            <div class="p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-xl">
              <UColorPicker
                :model-value="effectiveColor"
                mode="hex"
                @update:model-value="(val: string | undefined) => onPickerUpdate(val || '')"
              />
              <div v-if="isValidHex" class="mt-2 text-center text-xs font-mono text-gray-500 uppercase">
                {{ effectiveColor }}
              </div>
            </div>
          </template>
        </UPopover>
      </template>
    </UInput>
  </div>
</template>
