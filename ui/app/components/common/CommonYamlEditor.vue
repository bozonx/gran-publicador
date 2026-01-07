<script setup lang="ts">
import yaml from 'js-yaml'

interface Props {
  modelValue: Record<string, any> | null | undefined
  disabled?: boolean
  label?: string
  help?: string
  rows?: number
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  rows: 8,
  label: 'Meta (YAML)',
  help: ''
})

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, any> | null]
}>()

const { t } = useI18n()

// Internal YAML string representation
const yamlString = ref('')
const validationError = ref<string | undefined>(undefined)

/**
 * Recursively parse nested JSON strings in metadata.
 * Handles cases where metadata is double or triple encoded.
 */
function recursivelyParseJson(data: any, maxDepth = 5): any {
  if (maxDepth <= 0) return data
  
  if (typeof data === 'string') {
    try {
      const trimmed = data.trim()
      // Check if it looks like JSON before parsing
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
          (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        const parsed = JSON.parse(data)
        // Continue parsing recursively
        return recursivelyParseJson(parsed, maxDepth - 1)
      }
    } catch {
      // Not JSON, return as-is
      return data
    }
  } else if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    // Recursively parse object properties
    const result: Record<string, any> = {}
    for (const [key, value] of Object.entries(data)) {
      result[key] = recursivelyParseJson(value, maxDepth)
    }
    return result
  }
  
  return data
}

/**
 * Convert JSON object to YAML string for display
 */
function jsonToYaml(data: Record<string, any> | null | undefined): string {
  if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
    return ''
  }
  
  // Recursively parse any nested JSON strings
  const cleanData = recursivelyParseJson(data)
  
  try {
    return yaml.dump(cleanData, {
      indent: 2,
      lineWidth: -1, // Don't wrap lines
      noRefs: true, // Don't use anchors
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
  yamlString.value = jsonToYaml(newValue)
  // Clear validation error when modelValue changes externally
  validationError.value = undefined
}, { immediate: true, deep: true })

// Handle YAML string changes
function handleYamlChange(newYaml: string) {
  yamlString.value = newYaml
  
  // Validate and convert to JSON
  const result = yamlToJson(newYaml)
  
  if (result.success) {
    validationError.value = undefined
    emit('update:modelValue', result.data || {})
  } else {
    validationError.value = result.error
    // Still emit the change but with invalid data - parent will handle validation
  }
}

const displayValue = computed({
  get: () => yamlString.value,
  set: handleYamlChange
})
</script>

<template>
  <UFormField 
    :label="label" 
    :error="validationError"
    class="w-full"
  >
    <template #help>
      <div class="flex items-center justify-between w-full">
        <span class="text-sm text-gray-500 dark:text-gray-400">
          {{ help || t('media.yamlHelp', 'Additional metadata in YAML format') }}
        </span>
        <slot name="actions" />
      </div>
    </template>
    <UTextarea
      v-model="displayValue"
      :rows="rows"
      :disabled="disabled"
      class="font-mono text-xs w-full"
      autoresize
    />
  </UFormField>
</template>
