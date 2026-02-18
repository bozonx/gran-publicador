<script setup lang="ts">
import type { MediaOptimizationPreferences } from '~/stores/projects'

interface Props {
  modelValue?: MediaOptimizationPreferences
  disabled?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: MediaOptimizationPreferences): void
}>()

const { t } = useI18n()

// Default values constant
const DEFAULTS: MediaOptimizationPreferences = {
  stripMetadata: false,
  autoOrient: true,
  flatten: '',
  lossless: false,
}

// Local state for internal handling
const state = computed({
  get: () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const val = (props.modelValue || {}) as any
    // Normalize snake_case incoming props just in case
    const normalized = {
      ...val,
      stripMetadata: Boolean(val.stripMetadata ?? val['strip_metadata']),
      autoOrient: Boolean(val.autoOrient ?? val['auto_orient']),
      lossless: Boolean(val.lossless ?? val['lossless']),
    }
    return {
      ...DEFAULTS,
      ...normalized
    }
  },
  set: (val) => emit('update:modelValue', val)
})

function updateField<K extends keyof MediaOptimizationPreferences>(field: K, value: MediaOptimizationPreferences[K]) {
  emit('update:modelValue', {
    ...state.value,
    [field]: value
  })
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h4 class="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2">
        {{ t('settings.mediaOptimization.imagesDefaults', 'Image Upload Defaults') }}
      </h4>
    </div>

    <div class="space-y-6 animate-fade-in pl-4 border-l border-gray-100 dark:border-gray-800 ml-1">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Flags Group -->
      <div class="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-100 dark:border-gray-800 pt-4">

        <div class="flex items-center justify-between">
          <div class="flex flex-col">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('settings.mediaOptimization.stripMetadata') }}</label>
            <span class="text-xs text-gray-500">{{ t('settings.mediaOptimization.stripMetadataHelp') }}</span>
          </div>
          <USwitch
            :model-value="state.stripMetadata"
            :disabled="disabled"
            @update:model-value="(val: any) => updateField('stripMetadata', val)"
          />
        </div>

        <div class="flex items-center justify-between">
          <div class="flex flex-col">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('settings.mediaOptimization.autoOrient') }}</label>
            <span class="text-xs text-gray-500">{{ t('settings.mediaOptimization.autoOrientHelp') }}</span>
          </div>
          <USwitch
            :model-value="state.autoOrient"
            :disabled="disabled"
            @update:model-value="(val: any) => updateField('autoOrient', val)"
          />
        </div>

        <div class="flex items-center justify-between">
          <div class="flex flex-col">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('settings.mediaOptimization.lossless') }}</label>
            <span class="text-xs text-gray-500">{{ t('settings.mediaOptimization.losslessHelp', '') }}</span>
          </div>
          <USwitch
            :model-value="state.lossless"
            :disabled="disabled"
            @update:model-value="(val: any) => updateField('lossless', val)"
          />
        </div>

        <div class="md:col-span-1">
          <UFormField
            :label="t('settings.mediaOptimization.flatten', 'Flatten Transparency Color')"
            :help="t('settings.mediaOptimization.flattenHelp', 'Hex color to fill transparency (e.g., #ffffff). Leave empty to keep transparency.')"
          >
            <CommonHexColorPicker
              :model-value="state.flatten"
              :disabled="disabled"
              @update:model-value="(val: string) => updateField('flatten', val)"
            />
          </UFormField>
        </div>
      </div>
    </div>
    </div>
  </div>
</template>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
