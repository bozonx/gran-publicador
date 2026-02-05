<script setup lang="ts">
import { useRoles } from '~/composables/useRoles'
import type { Role, RolePermissions } from '~/types/roles.types'
import PermissionsEditor from './PermissionsEditor.vue'

const props = defineProps<{
  modelValue: boolean
  projectId: string
  role?: Role | null // If provided, edit mode. Else create mode.
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'success', role: Role): void
}>()

const { t } = useI18n()
const { createRole, updateRole } = useRoles()

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const isEditing = computed(() => !!props.role)
const isLoading = ref(false)

// Default permissions state
const defaultPermissions: RolePermissions = {
  project: { read: true, update: false },
  channels: { read: true, create: false, update: false, delete: false },
  publications: { read: true, create: false, updateOwn: false, updateAll: false, deleteOwn: false, deleteAll: false }
}

const form = ref({
  name: '',
  description: '',
  permissions: structuredClone(defaultPermissions)
})

// Initialize form when opening/changing role
watch(() => props.role, (newRole) => {
  if (newRole) {
    form.value = {
      name: newRole.name,
      description: newRole.description || '',
      permissions: {
        project: { ...newRole.permissions.project },
        channels: { ...newRole.permissions.channels },
        publications: { ...newRole.permissions.publications }
      }
    }
  } else {
    // Reset for create
    form.value = {
      name: '',
      description: '',
      permissions: structuredClone(defaultPermissions)
    }
  }
}, { immediate: true })

// Also watch open to reset if creating
watch(() => props.modelValue, (val) => {
  if (val && !props.role) {
    form.value = {
      name: '',
      description: '',
      permissions: structuredClone(defaultPermissions)
    }
  }
})

const isSystem = computed(() => props.role?.isSystem || false)

async function handleSubmit() {
  if (!form.value.name.trim()) return

  isLoading.value = true
  let result: Role | null = null

  if (isEditing.value && props.role) {
    result = await updateRole(props.role.id, {
      name: isSystem.value ? undefined : form.value.name, // System roles cannot change name
      description: form.value.description,
      permissions: form.value.permissions
    })
  } else {
    result = await createRole(props.projectId, {
      name: form.value.name,
      description: form.value.description,
      permissions: form.value.permissions
    })
  }

  isLoading.value = false

  if (result) {
    emit('success', result)
    isOpen.value = false
  }
}
</script>

<template>
  <UiAppModal 
    v-model:open="isOpen" 
    :title="isEditing ? t('roles.editRole') : t('roles.createRole')"
    :description="isSystem ? t('roles.cannotDeleteSystem') : undefined"
  >
    <form id="role-form" class="space-y-6" @submit.prevent="handleSubmit">
      <!-- Name functionality. Disabled if System role -->
      <UFormField :label="t('roles.roleName')">
        <UInput
          v-model="form.name"
          :placeholder="t('roles.roleNamePlaceholder')"
          autofocus
          :disabled="isSystem"
        />
        <p v-if="isSystem" class="text-xs text-gray-500 mt-1">
          {{ t('roles.systemRole') }} - {{ t('roles.cannotDeleteSystem') }}
        </p>
      </UFormField>

      <UFormField :label="t('roles.description', 'Description')">
        <UTextarea
          v-model="form.description"
          :placeholder="t('roles.descriptionPlaceholder', 'Enter role description...')"
          :rows="2"
        />
      </UFormField>

      <div class="border-t border-gray-200 dark:border-gray-800 pt-4">
        <h4 class="font-medium text-gray-900 dark:text-white mb-2">
          {{ t('roles.permissionsLabel') }}
        </h4>
        <p class="text-sm text-gray-500 mb-4">
          {{ t('roles.permissionsDescription') }}
        </p>
        
        <PermissionsEditor 
          v-model="form.permissions"
        />
      </div>
    </form>

    <template #footer>
      <UButton color="neutral" variant="ghost" @click="isOpen = false">
        {{ t('common.cancel') }}
      </UButton>
      <UButton 
        type="submit" 
        form="role-form" 
        color="primary" 
        :loading="isLoading" 
        :disabled="!form.name.trim()"
      >
        {{ t('common.save') }}
      </UButton>
    </template>
  </UiAppModal>
</template>
