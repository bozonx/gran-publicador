<script setup lang="ts">
import type { Database } from '~/types/database.types'
import type { ProjectMemberWithUser } from '~/stores/projects'
import type { TableColumn } from '@nuxt/ui'

// Re-defining BadgeColor locally as it matches UBadge prop type
type BadgeColor = 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'

const props = defineProps<{
  projectId: string
}>()

const { t } = useI18n()
const {
  fetchMembers,
  members,
  isLoading,
  removeMember,
  updateMemberRole,
  currentProject,
  canManageMembers,
} = useProjects()

const isInviteModalOpen = ref(false)

// Init
onMounted(() => {
  if (props.projectId) {
    fetchMembers(props.projectId)
  }
})

const canManage = computed(() => currentProject.value && canManageMembers(currentProject.value))

// Define typed columns for the table
const columns = computed<TableColumn<ProjectMemberWithUser>[]>(() => [
  { accessorKey: 'user', header: t('user.username') },
  { accessorKey: 'role', header: t('user.role') },
  { accessorKey: 'actions', header: '' },
])

function getRoleBadgeColor(role: string | undefined): BadgeColor {
  const colors: Record<string, BadgeColor> = {
    owner: 'primary',
    admin: 'secondary',
    editor: 'info',
    viewer: 'neutral',
  }
  return colors[role || 'viewer'] || 'neutral'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getActionItems(row: any) {
  const actions = []

  // Role change actions
  const roles: Database['public']['Enums']['project_role'][] = ['admin', 'editor', 'viewer']
  const roleActions = roles
    .filter((r) => r !== row.role)
    .map((role) => ({
      label: t(`roles.${role}`),
      icon: 'i-heroicons-arrow-path',
      click: () => updateMemberRole(props.projectId, row.user.id, role),
    }))

  if (roleActions.length > 0) {
    actions.push(roleActions)
  }

  // Remove action
  actions.push([
    {
      label: t('projectMember.remove'),
      icon: 'i-heroicons-trash-20-solid',
      click: () => handleRemove(row),
      class: 'text-red-500 dark:text-red-400',
    },
  ])

  return actions
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleRemove(row: any) {
  if (confirm(t('projectMember.removeConfirm'))) {
    await removeMember(props.projectId, row.user.id)
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex justify-between items-center">
      <h3 class="text-lg font-medium text-gray-900 dark:text-white">
        {{ t('projectMember.titlePlural') }}
      </h3>
      <UButton
        v-if="canManage"
        icon="i-heroicons-user-plus"
        size="sm"
        color="primary"
        @click="isInviteModalOpen = true"
      >
        {{ t('projectMember.invite') }}
      </UButton>
    </div>

    <UTable
      :data="members"
      :columns="columns"
      :loading="isLoading"
      :empty-state="{ icon: 'i-heroicons-users', label: t('common.noData') }"
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
          :color="getRoleBadgeColor(row.original.role ?? undefined)"
          size="xs"
          variant="subtle"
        >
          {{ t(`roles.${row.original.role ?? 'viewer'}`) }}
        </UBadge>
      </template>

      <template #actions-cell="{ row }">
        <UDropdownMenu
          v-if="canManage && row.original.role !== 'owner'"
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

    <ProjectsInviteMemberModal
      v-model="isInviteModalOpen"
      :project-id="projectId"
      @success="fetchMembers(projectId)"
    />
  </div>
</template>
