<script setup lang="ts">
import { useRoles } from '~/composables/useRoles'
import type { Role, RoleWithMemberCount } from '~/types/roles.types'
import type { TableColumn } from '@nuxt/ui'
import UiConfirmModal from '~/components/ui/UiConfirmModal.vue'
import RoleEditorModal from './RoleEditorModal.vue'

const props = defineProps<{
  projectId: string
}>()

const { t } = useI18n()
const { fetchRoles, roles, deleteRole, isLoading, getRoleDisplayName, getRoleBadgeColor } = useRoles()

onMounted(() => {
  if (props.projectId) {
    fetchRoles(props.projectId)
  }
})

// Columns
const columns = computed<TableColumn<RoleWithMemberCount>[]>(() => [
  { accessorKey: 'name', header: t('roles.roleName') },
  { accessorKey: 'memberCount', header: t('roles.memberCount') },
  { accessorKey: 'actions', header: '' },
])

// Editor Modal
const isEditorOpen = ref(false)
const selectedRole = ref<Role | null>(null)

function openCreate() {
  selectedRole.value = null
  isEditorOpen.value = true
}

function openEdit(role: Role) {
  selectedRole.value = role
  isEditorOpen.value = true
}

// Delete Confirmation
const isDeleteModalOpen = ref(false)
const roleToDelete = ref<RoleWithMemberCount | null>(null)
const isDeleting = ref(false)

function openDelete(role: RoleWithMemberCount) {
  roleToDelete.value = role
  isDeleteModalOpen.value = true
}

async function handleDelete() {
  if (!roleToDelete.value) return
  
  isDeleting.value = true
  // Check if members count > 0 is handled by backend or we should warn?
  // We warn in description
  const success = await deleteRole(roleToDelete.value.id)
  isDeleting.value = false
  
  if (success) {
    isDeleteModalOpen.value = false
    roleToDelete.value = null
  }
}

// Menu Items
function getActionItems(row: RoleWithMemberCount) {
  const actions = []
  
  // Edit action
  actions.push([{
    label: t('roles.editRole'),
    icon: 'i-heroicons-pencil-square',
    onSelect: () => openEdit(row)
  }])
  
  // Delete action (only for custom roles)
  if (!row.isSystem) {
    actions.push([{
      label: t('roles.deleteRole'),
      icon: 'i-heroicons-trash-20-solid',
      class: 'text-red-500 dark:text-red-400',
      onSelect: () => openDelete(row)
    }])
  }
  
  return actions
}

function handleSuccess() {
  fetchRoles(props.projectId)
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex justify-between items-center">
      <div>
        <!-- Optional header if needed outside of settings context, but usually settings title is enough -->
      </div>
      <UButton
        icon="i-heroicons-plus"
        color="primary"
        @click="openCreate"
      >
        {{ t('roles.createRole') }}
      </UButton>
    </div>

    <UTable
      :data="roles"
      :columns="columns"
      :loading="isLoading"
      :empty-state="{ icon: 'i-heroicons-user-group', label: t('roles.noRoles') }"
      class="w-full"
    >
      <template #name-cell="{ row }">
        <div class="flex items-center gap-2">
          <span>{{ getRoleDisplayName(row.original) }}</span>
          <UBadge 
            v-if="row.original.isSystem" 
            :color="getRoleBadgeColor(row.original)" 
            size="xs" 
            variant="subtle"
          >
            {{ t('roles.systemRole') }}
          </UBadge>
          <UBadge 
            v-else 
            color="neutral" 
            size="xs" 
            variant="subtle"
          >
            {{ t('roles.customRole') }}
          </UBadge>
        </div>
      </template>

      <template #memberCount-cell="{ row }">
        {{ t('roles.memberCount', { count: row.original.memberCount || 0 }, row.original.memberCount || 0) }}
      </template>

      <template #actions-cell="{ row }">
        <UDropdownMenu :items="getActionItems(row.original)">
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-heroicons-ellipsis-vertical-20-solid"
            size="xs"
          />
        </UDropdownMenu>
      </template>
    </UTable>

    <!-- Editor Modal -->
    <RoleEditorModal
      v-model="isEditorOpen"
      :project-id="projectId"
      :role="selectedRole"
      @success="handleSuccess"
    />

    <!-- Delete Confirmation -->
    <UiConfirmModal
      v-model:open="isDeleteModalOpen"
      :title="t('roles.deleteRole')"
      :description="roleToDelete?.memberCount && roleToDelete.memberCount > 0 
        ? t('roles.deleteWarning', { count: roleToDelete.memberCount }) 
        : t('roles.deleteConfirm')"
      :confirm-text="t('common.delete')"
      color="error"
      :loading="isDeleting"
      @confirm="handleDelete"
    />
  </div>
</template>
