<script setup lang="ts">
import { useProjects } from '~/composables/useProjects'
import type { ProjectWithRole } from '~/stores/projects'

interface Props {
  modelValue?: string | null
  excludeIds?: string[]
  placeholder?: string
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  excludeIds: () => [],
  placeholder: undefined,
  disabled: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { projects, fetchProjects, isLoading } = useProjects()
const { user } = useAuth()
const { t } = useI18n()

// Ensure projects are loaded
onMounted(async () => {
  if (projects.value.length === 0) {
    await fetchProjects(false)
  }
})

const sortedProjects = computed(() => {
  const list = projects.value.filter(p => !p.archivedAt && !props.excludeIds.includes(p.id))
  const order = user.value?.projectOrder || []
  
  if (order.length === 0) return [...list].sort((a, b) => a.name.localeCompare(b.name))
  
  return [...list].sort((a, b) => {
    const indexA = order.indexOf(a.id)
    const indexB = order.indexOf(b.id)
    
    if (indexA === -1 && indexB === -1) return a.name.localeCompare(b.name)
    if (indexA === -1) return 1
    if (indexB === -1) return -1
    
    return indexA - indexB
  })
})

const projectOptions = computed(() => {
  return sortedProjects.value.map(p => ({
    value: p.id,
    label: p.name
  }))
})

// Validation and Default Selection logic
watch(projectOptions, (newOptions) => {
  if (newOptions.length > 0) {
    // If current value is not in options, select the first one
    if (!props.modelValue || !newOptions.some(opt => opt.value === props.modelValue)) {
      emit('update:modelValue', newOptions[0].value)
    }
  }
}, { immediate: true })

// Handle case where modelValue is initially empty but we have projects
watch(() => props.modelValue, (newVal) => {
  if (!newVal && projectOptions.value.length > 0) {
    emit('update:modelValue', projectOptions.value[0].value)
  }
}, { immediate: true })

const internalValue = computed({
  get: () => props.modelValue || undefined,
  set: (val) => {
    if (val) emit('update:modelValue', val)
  }
})
</script>

<template>
  <USelectMenu
    v-model="internalValue"
    :items="projectOptions"
    value-key="value"
    label-key="label"
    :loading="isLoading"
    :disabled="disabled"
    :placeholder="placeholder || t('project.select_project')"
    icon="i-heroicons-briefcase"
    class="w-full"
    v-bind="$attrs"
  >
    <template #leading>
      <UIcon name="i-heroicons-briefcase" class="w-4 h-4" />
    </template>
  </USelectMenu>
</template>
