<script setup lang="ts">
import type { MediaOptimizationPreferences } from '~/stores/projects'
import { MEDIA_OPTIMIZATION_PRESETS, type MediaOptimizationPresetKey } from '~/utils/media-presets'

interface Props {
  modelValue?: MediaOptimizationPreferences
  disabled?: boolean
  projectDefaults?: MediaOptimizationPreferences
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: MediaOptimizationPreferences): void
}>()

const { t } = useI18n()

// Default values constant
const DEFAULTS: MediaOptimizationPreferences = {
  quality: 80,
  lossless: false,
  stripMetadata: false,
  autoOrient: true,
  flatten: '',
  chromaSubsampling: '4:2:0'
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
      chromaSubsampling: val.chromaSubsampling ?? val['chroma_subsampling'],
      quality: Number(val.quality ?? 80),
      lossless: Boolean(val.lossless),
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

const presetOptions = computed(() => {
  const options = [
    { value: 'standard', label: 'Standard' },
    { value: 'optimal', label: 'Optimal' },
    { value: 'visual-lossless', label: 'Visual Lossless' },
    { value: 'lossless', label: 'Lossless' }
  ]
  
  if (props.projectDefaults) {
    options.unshift({ value: 'project', label: 'Project' })
  }
  
  return options
})

const currentPreset = ref<MediaOptimizationPresetKey | 'project' | ''>('')

function applyPreset(presetKey: MediaOptimizationPresetKey | 'project') {
  if (presetKey === 'project') {
    if (props.projectDefaults) {
      currentPreset.value = 'project'
      emit('update:modelValue', {
        ...state.value,
        ...props.projectDefaults,
      })
    }
    return
  }

  const preset = MEDIA_OPTIMIZATION_PRESETS[presetKey]
  currentPreset.value = presetKey
  emit('update:modelValue', {
    ...state.value,
    ...preset,
  })
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h4 class="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2">
        {{ t('settings.mediaOptimization.images', 'Images') }}
      </h4>
    </div>

    <div class="space-y-6 animate-fade-in pl-4 border-l border-gray-100 dark:border-gray-800 ml-1">
      
      <!-- Presets Selector -->
      <UFormField
        :label="t('settings.mediaOptimization.preset', 'Optimization Preset')"
        :help="t('settings.mediaOptimization.presetHelp', 'Choose a predefined optimization level')"
      >
        <UiAppButtonGroup
          :model-value="currentPreset"
          :options="presetOptions"
          :disabled="disabled"
          variant="outline"
          active-variant="solid"
          size="sm"
          @update:model-value="(val) => applyPreset(val as MediaOptimizationPresetKey | 'project')"
        />
      </UFormField>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Quality -->
      <UFormField
        :label="t('settings.mediaOptimization.quality', 'Quality')"
        :help="`${state.quality}% — ${t('settings.mediaOptimization.qualityHelp', 'Compression quality (1-100)')}`"
      >
        <div class="pt-2">
          <input
            type="range"
            :value="state.quality"
            :disabled="disabled"
            min="1"
            max="100"
            step="1"
            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            @input="(e) => updateField('quality', Number((e.target as HTMLInputElement).value))"
          />
        </div>
      </UFormField>

      <UFormField
        :label="t('settings.mediaOptimization.chromaSubsampling', 'Chroma Subsampling')"
      >
      <UiAppButtonGroup
        :model-value="state.chromaSubsampling"
        :options="[
          { value: '4:2:0', label: '4:2:0' },
          { value: '4:4:4', label: '4:4:4' }
        ]"
        :disabled="disabled"
        variant="outline"
        active-variant="solid"
        active-color="primary"
        @update:model-value="(val: string | number | boolean) => updateField('chromaSubsampling', val as any)"
      />
      </UFormField>

      <!-- Flags Group -->
      <div class="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-100 dark:border-gray-800 pt-4">
        
        <div class="flex items-center justify-between">
          <label class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('settings.mediaOptimization.lossless') }}</label>
          <USwitch
            :model-value="state.lossless"
            :disabled="disabled"
            @update:model-value="(val: any) => updateField('lossless', val)"
          />
        </div>

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


      </div>

      <!-- Flatten Color -->
      <div class="md:col-span-2">
         <UFormField
          :label="t('settings.mediaOptimization.flatten', 'Flatten Transparency Color')"
          :help="t('settings.mediaOptimization.flattenHelp', 'Hex color to fill transparency (e.g., #ffffff). Leave empty to keep transparency.')"
        >
          <div class="flex gap-2">
            <UInput
              :model-value="state.flatten"
              :disabled="disabled"
              placeholder="#ffffff"
              @update:model-value="(val: string) => updateField('flatten', val)"
            />
            <div 
              v-if="state.flatten && /^#[0-9A-F]{6}$/i.test(state.flatten)"
              class="w-10 h-10 rounded border border-gray-200 dark:border-gray-700 shrink-0"
              :style="{ backgroundColor: state.flatten }"
            ></div>
          </div>
        </UFormField>
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
