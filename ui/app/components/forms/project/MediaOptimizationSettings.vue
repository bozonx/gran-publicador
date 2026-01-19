<script setup lang="ts">
import { z } from 'zod'
import { FORM_STYLES, FORM_SPACING } from '../../../utils/design-tokens'
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
  enabled: false,
  format: 'avif',
  quality: 80,
  maxDimension: 3840,
  lossless: false,
  stripMetadata: false,
  autoOrient: true,
  flatten: '',
  chromaSubsampling: '4:2:0',
  effort: 6
}

// Local state for internal handling
const state = computed({
  get: () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const val = (props.modelValue || {}) as any
    // Normalize snake_case incoming props just in case
    const normalized = {
      ...val,
      enabled: Boolean(
        val.enabled ?? 
        val['enabled'] ?? 
        val['is_enabled'] ?? 
        // If no explicit enabled flag, but we have configuration keys, assume it's enabled
        (val.format || val.quality || val.maxDimension || val.max_dimension ? true : false)
      ),
      stripMetadata: Boolean(val.stripMetadata ?? val['strip_metadata']),
      autoOrient: Boolean(val.autoOrient ?? val['auto_orient']),
      chromaSubsampling: val.chromaSubsampling ?? val['chroma_subsampling'],
      maxDimension: val.maxDimension ?? val['max_dimension'],
      quality: Number(val.quality ?? 80),
      effort: Number(val.effort ?? 6),
      lossless: Boolean(val.lossless),
    }
    return {
      ...DEFAULTS,
      ...normalized
    }
  },
  set: (val) => emit('update:modelValue', val)
})

// Validation schema for local inputs (if we need to show errors inline)
// Though main validation happens in parent form
const schema = z.object({
  format: z.enum(['webp', 'avif']),
  quality: z.number().min(1).max(100),
  maxDimension: z.number().min(1),
  effort: z.number().min(0).max(9),
})

function updateField<K extends keyof MediaOptimizationPreferences>(field: K, value: MediaOptimizationPreferences[K]) {
  emit('update:modelValue', {
    ...state.value,
    [field]: value
  })
}

// Ensure defaults if enabled is toggled on and fields are missing
function handleEnabledToggle(val: boolean) {
  if (val) {
    emit('update:modelValue', {
      ...state.value, // This already includes defaults mixed with props thanks to getter
      enabled: true
    })
  } else {
    updateField('enabled', false)
  }
}</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h3 :class="FORM_STYLES.sectionTitle">
          {{ t('settings.mediaOptimization.title', 'Media Optimization') }}
        </h3>
        <p :class="FORM_STYLES.subtitle">
          {{ t('settings.mediaOptimization.description', 'Configure default optimization settings for uploaded media') }}
        </p>
      </div>
      <USwitch
        :model-value="state.enabled"
        :disabled="disabled"
        @update:model-value="handleEnabledToggle"
      />
    </div>

    <div v-if="state.enabled" class="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
      
      <!-- Format -->
      <UFormField
        :label="t('settings.mediaOptimization.format', 'Format')"
        :help="t('settings.mediaOptimization.formatHelp', 'Target output format')"
      >
        <div class="inline-flex p-1 bg-gray-100 dark:bg-gray-800 rounded-lg shadow-inner">
          <button
            type="button"
            @click="updateField('format', 'avif')"
            :disabled="disabled"
            :class="[
              'px-6 py-1.5 text-sm font-medium rounded-md transition-all duration-200',
              state.format === 'avif' 
                ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            ]"
          >
            AVIF
          </button>
          <button
            type="button"
            @click="updateField('format', 'webp')"
            :disabled="disabled"
            :class="[
              'px-6 py-1.5 text-sm font-medium rounded-md transition-all duration-200',
              state.format === 'webp' 
                ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            ]"
          >
            WebP
          </button>
        </div>
      </UFormField>

      <!-- Quality -->
      <UFormField
        :label="t('settings.mediaOptimization.quality', 'Quality')"
        :help="`${state.quality}% — ${t('settings.mediaOptimization.qualityHelp', 'Compression quality (1-100)')}`"
      >
        <div class="pt-2">
          <input
            type="range"
            :value="state.quality"
            @input="(e) => updateField('quality', Number((e.target as HTMLInputElement).value))"
            :disabled="disabled"
            min="1"
            max="100"
            step="1"
            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </UFormField>

      <!-- Max Dimension -->
      <UFormField
        :label="t('settings.mediaOptimization.maxDimension', 'Max Dimension')"
        :help="t('settings.mediaOptimization.maxDimensionHelp', 'Resize if width or height exceeds this px value')"
      >
        <UInput
          type="number"
          :model-value="state.maxDimension"
          :disabled="disabled"
          placeholder="3840"
          @update:model-value="val => updateField('maxDimension', Number(val))"
        />
      </UFormField>

      <!-- Effort -->
      <UFormField
        :label="t('settings.mediaOptimization.effort', 'CPU Effort')"
        :help="`${state.effort} — ${t('settings.mediaOptimization.effortHelp', 'Higher is slower but better compression (0-9)')}`"
      >
        <div class="pt-2">
          <input
            type="range"
            :value="state.effort"
            @input="(e) => updateField('effort', Number((e.target as HTMLInputElement).value))"
            :disabled="disabled"
            min="0"
            max="9"
            step="1"
            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </UFormField>
      <!-- Flags Group -->
      <div class="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-100 dark:border-gray-800 pt-4">
        
        <!-- Lossless (WebP only) -->
        <div v-if="state.format === 'webp'" class="flex items-center justify-between">
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

       <!-- AVIF Specific -->
      <div v-if="state.format === 'avif'" class="md:col-span-2 border-t border-gray-100 dark:border-gray-800 pt-4">
        <UFormField
          :label="t('settings.mediaOptimization.chromaSubsampling', 'Chroma Subsampling')"
        >
          <div class="inline-flex p-1 bg-gray-100 dark:bg-gray-800 rounded-lg shadow-inner">
            <button
              type="button"
              @click="updateField('chromaSubsampling', '4:2:0')"
              :disabled="disabled"
              :class="[
                'px-6 py-1.5 text-sm font-medium rounded-md transition-all duration-200',
                state.chromaSubsampling === '4:2:0' 
                  ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              ]"
            >
              4:2:0
            </button>
            <button
              type="button"
              @click="updateField('chromaSubsampling', '4:4:4')"
              :disabled="disabled"
              :class="[
                'px-6 py-1.5 text-sm font-medium rounded-md transition-all duration-200',
                state.chromaSubsampling === '4:4:4' 
                  ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              ]"
            >
              4:4:4
            </button>
          </div>
        </UFormField>
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
