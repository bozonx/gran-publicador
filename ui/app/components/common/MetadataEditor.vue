<script setup lang="ts">
import yaml from 'js-yaml'


interface Props {
  modelValue: Record<string, any> | null | undefined
  label?: string
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  label: 'Meta (YAML)',
  disabled: false
})

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, any> | null]
}>()

const { t } = useI18n()

// State
const isEditing = ref(false)
const yamlString = ref('')
const validationError = ref<string | undefined>(undefined)

/**
 * Convert JSON object to YAML string for display
 */
function jsonToYaml(data: Record<string, any> | null | undefined): string {
  if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
    return ''
  }
  
  try {
    return yaml.dump(data, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      sortKeys: false
    })
  } catch (e) {
    console.error('Failed to convert to YAML:', e)
    return ''
  }
}

/**
 * Parse YAML string back to JSON object
 */
function yamlToJson(yamlStr: string): { success: boolean; data?: Record<string, any>; error?: string } {
  // Empty string means empty object
  if (!yamlStr || yamlStr.trim() === '') {
    return { success: true, data: {} }
  }
  
  try {
    const parsed = yaml.load(yamlStr)
    
    // Validate that result is an object
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { 
        success: false, 
        error: t('validation.invalidYaml', 'Must be a valid YAML object (key-value pairs), not a list or value')
      }
    }
    
    return { success: true, data: parsed as Record<string, any> }
  } catch (e: any) {
    return { 
      success: false, 
      error: e.message || t('validation.invalidYaml', 'Invalid YAML syntax')
    }
  }
}

// Initialize YAML string from modelValue
watch(() => props.modelValue, (newValue) => {
  if (isEditing.value) return

  // Check if new value is effectively the same as current string representation
  // This prevents reformatting YAML (losing comments/spacing) when data hasn't changed
  const currentParsed = yamlToJson(yamlString.value)
  if (currentParsed.success && JSON.stringify(currentParsed.data) === JSON.stringify(newValue || {})) {
    return
  }

  yamlString.value = jsonToYaml(newValue)
}, { immediate: true, deep: true })

// Debounced update function
const debouncedUpdate = useDebounceFn((newYaml: string) => {
  const result = yamlToJson(newYaml)
  
  if (result.success) {
    validationError.value = undefined
    emit('update:modelValue', result.data || {})
  } else {
    validationError.value = result.error
    // Don't emit invalid data
  }
}, 500)

// Handle YAML string changes
function handleYamlChange(newYaml: string) {
  yamlString.value = newYaml
  debouncedUpdate(newYaml)
}

// Toggle edit mode
function startEditing() {
  isEditing.value = true
  if (!yamlString.value && props.modelValue) {
      yamlString.value = jsonToYaml(props.modelValue)
  }
  validationError.value = undefined
}

function stopEditing() {
  isEditing.value = false
}

const displayValue = computed({
  get: () => yamlString.value,
  set: handleYamlChange
})

const hasContent = computed(() => {
  return props.modelValue && Object.keys(props.modelValue).length > 0
})
</script>

<template>
  <div class="space-y-2">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
        <UIcon name="i-heroicons-code-bracket" class="w-4 h-4" />
        {{ label }}
      </div>
      
      <UButton
        v-if="!disabled && !isEditing"
        size="xs"
        variant="ghost"
        color="neutral"
        icon="i-heroicons-pencil"
        @click="startEditing"
      >
        {{ t('common.edit', 'Edit') }}
      </UButton>
    </div>

    <!-- View Mode -->
    <div 
      v-if="!isEditing"
      class="bg-gray-100 dark:bg-gray-800 rounded-md p-4 overflow-x-auto border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700/80 transition-colors group relative"
      :class="{ 'min-h-[60px] flex items-center justify-center': !hasContent }"
      @click="startEditing"
    >
      <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <UIcon name="i-heroicons-pencil" class="w-4 h-4 text-gray-500" />
      </div>
      <pre 
        v-if="hasContent"
        class="text-xs font-mono text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre"
      >{{ displayValue || '---' }}</pre>
      <span 
        v-else 
        class="text-xs text-gray-400 italic"
      >{{ t('common.noData', 'No metadata') }}</span>
    </div>

    <!-- Edit Mode -->
    <div v-else class="space-y-2">
      <UTextarea
        v-model="displayValue"
        :rows="8"
        class="font-mono text-xs w-full"
        autoresize
        autofocus
        :placeholder="t('post.metadataPlaceholder')"
        @blur="stopEditing"
      />
      
      <!-- Validation Error -->
      <UAlert
        v-if="validationError"
        color="error"
        variant="soft"
        icon="i-heroicons-exclamation-circle"
        :title="t('validation.yamlError')"
        :description="validationError"
      />
      
      <!-- Help Text -->
      <p class="text-xs text-gray-500 dark:text-gray-400">
        {{ t('post.metadataHelp') }}
      </p>
    </div>
  </div>
</template>
