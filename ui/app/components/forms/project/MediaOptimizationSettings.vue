<script setup lang="ts">
import { z } from 'zod'
import { FORM_STYLES, FORM_SPACING } from '~/utils/design-tokens'
import type { MediaOptimizationPreferences } from '~/stores/projects'

interface Props {
  modelValue: MediaOptimizationPreferences
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
  format: 'webp',
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
  get: () => props.modelValue || { ...DEFAULTS },
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
      ...DEFAULTS, // Apply defaults first
      ...state.value, // Override with existing values if any
      enabled: true
    })
  } else {
    updateField('enabled', false)
  }
}
</script>

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
      <UToggle
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
        <USelectMenu
          :model-value="state.format"
          :options="[{ label: 'WebP', value: 'webp' }, { label: 'AVIF', value: 'avif' }]"
          value-attribute="value"
          option-attribute="label"
          :disabled="disabled"
          @update:model-value="(val: any) => updateField('format', val)"
        />
      </UFormField>

      <!-- Quality -->
      <UFormField
        :label="t('settings.mediaOptimization.quality', 'Quality')"
        :help="`${state.quality}% — ${t('settings.mediaOptimization.qualityHelp', 'Compression quality (1-100)')}`"
      >
        <URange
          :min="1"
          :max="100"
          :step="1"
          :model-value="state.quality"
          :disabled="disabled"
          @update:model-value="(val: number) => updateField('quality', val)"
        />
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
        <URange
          :min="0"
          :max="9"
          :step="1"
          :model-value="state.effort"
          :disabled="disabled"
          @update:model-value="(val: number) => updateField('effort', val)"
        />
      </UFormField>

      <!-- Flags Group -->
      <div class="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-100 dark:border-gray-800 pt-4">
        
        <!-- Lossless (WebP only) -->
        <UCheckbox
          v-if="state.format === 'webp'"
          :model-value="state.lossless"
          :label="t('settings.mediaOptimization.lossless', 'Lossless Compression')"
          :disabled="disabled"
          @update:model-value="(val: any) => updateField('lossless', val)"
        />

        <!-- Strip Metadata -->
        <UCheckbox
          :model-value="state.stripMetadata"
          :label="t('settings.mediaOptimization.stripMetadata', 'Strip Metadata')"
          :help="t('settings.mediaOptimization.stripMetadataHelp', 'Remove EXIF and other metadata')"
          :disabled="disabled"
          @update:model-value="(val: any) => updateField('stripMetadata', val)"
        />

        <!-- Auto Orient -->
        <UCheckbox
          :model-value="state.autoOrient"
          :label="t('settings.mediaOptimization.autoOrient', 'Auto Orient')"
          :help="t('settings.mediaOptimization.autoOrientHelp', 'Rotate image based on EXIF')"
          :disabled="disabled"
          @update:model-value="(val: any) => updateField('autoOrient', val)"
        />
      </div>

       <!-- AVIF Specific -->
      <div v-if="state.format === 'avif'" class="md:col-span-2 border-t border-gray-100 dark:border-gray-800 pt-4">
        <UFormField
          :label="t('settings.mediaOptimization.chromaSubsampling', 'Chroma Subsampling')"
        >
          <USelectMenu
            :model-value="state.chromaSubsampling"
            :options="[{ label: '4:2:0', value: '4:2:0' }, { label: '4:4:4', value: '4:4:4' }]"
            value-attribute="value"
            option-attribute="label"
            :disabled="disabled"
            @update:model-value="(val: any) => updateField('chromaSubsampling', val)"
          />
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
