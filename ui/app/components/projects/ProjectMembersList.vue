<script setup lang="ts">
import type { ProjectMemberWithUser } from '~/stores/projects'
import type { TableColumn } from '@nuxt/ui'
import UiConfirmModal from '~/components/ui/UiConfirmModal.vue'
import { useRoles } from '~/composables/useRoles'

const props = defineProps<{
  projectId: string
}>()

const { t } = useI18n()
const {
  fetchMembers,
  members,
  isLoading,
  removeMember,
  updateMemberRoleId,
  currentProject,
  canManageMembers,
} = useProjects()

const { 
  fetchRoles, 
  roles: projectRoles, 
  getRoleDisplayName, 
  getRoleBadgeColor 
} = useRoles()

// Init
onMounted(async () => {
  if (props.projectId) {
    // Fetch both members and roles
    await Promise.all([
      fetchMembers(props.projectId),
      fetchRoles(props.projectId)
    ])
  }
})

const canManage = computed(() => currentProject.value && canManageMembers(currentProject.value))

// Define typed columns for the table
const columns = computed<TableColumn<ProjectMemberWithUser>[]>(() => [
  { accessorKey: 'user', header: t('user.username') },
  { accessorKey: 'role', header: t('user.role') },
  { accessorKey: 'actions', header: '' },
])

// Confirmation Modal State
const isConfirmModalOpen = ref(false)
const isConfirming = ref(false)
const confirmModalConfig = ref({
    title: '',
    description: '',
    confirmText: '',
    color: 'primary' as 'primary' | 'error' | 'warning',
    action: async () => {},
})

/**
 * Open confirmation modal with specific configuration
 */
function openConfirmModal(config: {
    title: string
    description: string
    confirmText?: string
    color?: 'primary' | 'error' | 'warning'
    action: () => Promise<any>
}) {
    confirmModalConfig.value = {
        title: config.title,
        description: config.description,
        confirmText: config.confirmText || t('common.confirm'),
        color: config.color || 'primary',
        action: config.action
    }
    isConfirmModalOpen.value = true
}

/**
 * Handle the actual confirmation action
 */
async function handleConfirm() {
    isConfirming.value = true
    try {
        await confirmModalConfig.value.action()
        isConfirmModalOpen.value = false
    } catch (e) {
        console.error('Action failed:', e)
    } finally {
        isConfirming.value = false
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getActionItems(row: any) {
  const actions = []

  // Role change actions
  // Filter out current role
  const roleActions = projectRoles.value
    .filter((r) => r.id !== row.role?.id)
    .map((role) => ({
      label: getRoleDisplayName(role),
      icon: 'i-heroicons-arrow-path',
      onSelect: () => openConfirmModal({
          title: t('projectMember.changeRoleTitle'),
          description: t('projectMember.changeRoleConfirm', { 
              user: row.user.fullName || row.user.telegramUsername, 
              role: getRoleDisplayName(role) 
          }),
          confirmText: t('common.save'),
          action: () => updateMemberRoleId(props.projectId, row.user.id, role.id)
      }),
    }))

  if (roleActions.length > 0) {
    actions.push(roleActions)
  }

  // Remove action
  actions.push([
    {
      label: t('projectMember.remove'),
      icon: 'i-heroicons-trash-20-solid',
      onSelect: () => openConfirmModal({
          title: t('projectMember.removeTitle'),
          description: t('projectMember.removeConfirm', { 
              user: row.user.fullName || row.user.telegramUsername 
          }),
          color: 'error',
          confirmText: t('common.delete'),
          action: () => removeMember(props.projectId, row.user.id)
      }),
      class: 'text-red-500 dark:text-red-400',
    },
  ])

  return actions
}
</script>

<template>
  <div class="space-y-4">
    <UTable
      :data="members"
      :columns="columns"
      :loading="isLoading"
      :empty-state="{ icon: 'i-heroicons-user-group', label: t('common.noData') }"
      class="w-full"
    >
      <template #user-cell="{ row }">
        <div class="flex items-center gap-3">
          <UAvatar
            :src="row.original.user.avatarUrl ?? undefined"
            :alt="row.original.user.telegramUsername ?? row.original.user.fullName ?? undefined"
            size="sm"
          />
          <div>
            <div class="font-medium text-gray-900 dark:text-white text-sm">
              {{ row.original.user.fullName || row.original.user.telegramUsername }}
            </div>
          </div>
        </div>
      </template>

      <template #role-cell="{ row }">
        <UBadge
          :color="getRoleBadgeColor(row.original.role)"
          size="xs"
          variant="subtle"
        >
          {{ getRoleDisplayName(row.original.role) }}
        </UBadge>
      </template>

      <template #actions-cell="{ row }">
        <UDropdownMenu
          v-if="canManage && row.original.userId !== currentProject?.ownerId"
          :items="getActionItems(row.original)"
        >
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-heroicons-ellipsis-vertical-20-solid"
            size="xs"
          />
        </UDropdownMenu>
      </template>
    </UTable>

    <UiConfirmModal
        v-model:open="isConfirmModalOpen"
        :title="confirmModalConfig.title"
        :description="confirmModalConfig.description"
        :confirm-text="confirmModalConfig.confirmText"
        :color="confirmModalConfig.color"
        :loading="isConfirming"
        @confirm="handleConfirm"
    />
  </div>
</template>
