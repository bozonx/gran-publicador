<script setup lang="ts">
import { useProjects } from '~/composables/useProjects'
import type { ProjectWithRole } from '~/stores/projects'

interface ProjectOption {
  value: string | null
  label: string
  [key: string]: any
}

interface Props {
  excludeIds?: string[]
  placeholder?: string
  disabled?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  extraOptions?: ProjectOption[]
}

const props = withDefaults(defineProps<Props>(), {
  excludeIds: () => [],
  placeholder: undefined,
  disabled: false,
  size: 'md',
  extraOptions: () => []
})

const modelValue = defineModel<string | null>({ default: null })

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
  const options = sortedProjects.value.map(p => ({
    value: p.id,
    label: p.name
  }))
  return [...props.extraOptions, ...options]
})

// Validation and Default Selection logic
watch(projectOptions, (newOptions) => {
  if (newOptions.length > 0) {
    if (!modelValue.value || !newOptions.some(opt => opt.value === modelValue.value)) {
      modelValue.value = newOptions[0].value
    }
  }
}, { immediate: true })

watch(modelValue, (newVal) => {
  if (!newVal && projectOptions.value.length > 0) {
    modelValue.value = projectOptions.value[0].value
  }
}, { immediate: true })

const internalValue = computed({
  get: () => modelValue.value ?? undefined,
  set: (val) => {
    modelValue.value = val ?? null
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
    :size="size"
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
