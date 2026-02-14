<script setup lang="ts">
import { FORM_STYLES } from '~/utils/design-tokens'
import type { MediaOptimizationPreferences } from '~/stores/projects'

interface Props {
  modelValue?: MediaOptimizationPreferences
  disabled?: boolean
  hideHeader?: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: MediaOptimizationPreferences): void
}>()

const { t } = useI18n()

// Proxy the v-model updates
function handleUpdate(value: MediaOptimizationPreferences) {
  emit('update:modelValue', value)
}
</script>

<template>
  <div class="w-full">
    <div v-if="!hideHeader" class="mb-6">
      <h3 :class="FORM_STYLES.sectionTitle">
        {{ t('settings.mediaOptimization.title', 'Media Optimization') }}
      </h3>
      <p :class="FORM_STYLES.subtitle">
        {{ t('settings.mediaOptimization.description', 'Configure default optimization values applied when uploading media') }}
      </p>
    </div>
    
    <FormsProjectMediaOptimizationSettings
      :model-value="modelValue"
      :disabled="disabled"
      @update:model-value="handleUpdate"
    />
  </div>
</template>
