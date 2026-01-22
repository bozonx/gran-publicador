<script setup lang="ts">
import type { RolePermissions } from '~/types/roles.types'

const props = defineProps<{
  modelValue: RolePermissions
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: RolePermissions): void
}>()

const { t } = useI18n()

// Deep copy of permissions to avoid direct prop mutation
const localPermissions = ref<RolePermissions>({
  project: { ...props.modelValue.project },
  channels: { ...props.modelValue.channels },
  publications: { ...props.modelValue.publications }
})

// Watch for external changes
watch(() => props.modelValue, (newVal) => {
  if (JSON.stringify(newVal) !== JSON.stringify(localPermissions.value)) {
    localPermissions.value = {
      project: { ...newVal.project },
      channels: { ...newVal.channels },
      publications: { ...newVal.publications }
    }
  }
}, { deep: true })

// Emit changes
watch(localPermissions, (newVal) => {
  emit('update:modelValue', newVal)
}, { deep: true })

const sections = [
  {
    key: 'project' as const,
    title: 'roles.permissions.project.title',
    items: ['read', 'update'] as const
  },
  {
    key: 'channels' as const,
    title: 'roles.permissions.channels.title',
    items: ['read', 'create', 'update', 'delete'] as const
  },
  {
    key: 'publications' as const,
    title: 'roles.permissions.publications.title',
    items: ['read', 'create', 'updateOwn', 'updateAll', 'deleteOwn', 'deleteAll'] as const
  }
]
</script>

<template>
  <div class="space-y-6">
    <div v-for="section in sections" :key="section.key" class="space-y-3">
      <h3 class="font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-800 pb-2">
        {{ t(section.title) }}
      </h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <!-- We use v-if because TypeScript cannot infer correct keys for general iteration -->
        <template v-if="section.key === 'project'">
          <UCheckbox
            v-for="item in section.items"
            :key="`project.${item}`"
            v-model="localPermissions.project[item as keyof typeof localPermissions.project]"
            :label="t(`roles.permissions.project.${item}`)"
            :disabled="disabled"
          />
        </template>
        <template v-else-if="section.key === 'channels'">
          <UCheckbox
            v-for="item in section.items"
            :key="`channels.${item}`"
            v-model="localPermissions.channels[item as keyof typeof localPermissions.channels]"
            :label="t(`roles.permissions.channels.${item}`)"
            :disabled="disabled"
          />
        </template>
        <template v-else-if="section.key === 'publications'">
          <UCheckbox
            v-for="item in section.items"
            :key="`publications.${item}`"
            v-model="localPermissions.publications[item as keyof typeof localPermissions.publications]"
            :label="t(`roles.permissions.publications.${item}`)"
            :disabled="disabled"
          />
        </template>
      </div>
    </div>
  </div>
</template>
