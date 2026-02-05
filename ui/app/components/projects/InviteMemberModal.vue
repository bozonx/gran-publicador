<script setup lang="ts">
import { useProjects } from '~/composables/useProjects'
import { useRoles } from '~/composables/useRoles'
import { SystemRoleType } from '~/types/roles.types'

const props = defineProps<{
  modelValue: boolean
  projectId: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'success'): void
}>()

const { t } = useI18n()
const { addMember } = useProjects()
const { fetchRoles, roles: projectRoles, getRoleDisplayName } = useRoles()

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const isLoading = ref(false)
const username = ref('')
const selectedRoleId = ref<string>('')

// Fetch roles when modal opens
watch(() => props.modelValue, async (val) => {
  if (val && props.projectId) {
    await fetchRoles(props.projectId)
    // Set default selection to Viewer or first available
    const viewerRole = projectRoles.value.find(r => r.systemType === SystemRoleType.VIEWER)
    selectedRoleId.value = viewerRole?.id || projectRoles.value[0]?.id || ''
  }
})

const roleOptions = computed(() => {
  return projectRoles.value.map(role => ({
    label: getRoleDisplayName(role),
    value: role.id
  }))
})

async function handleInvite() {
  if (!username.value || !selectedRoleId.value) return

  isLoading.value = true
  const success = await addMember(props.projectId, username.value, selectedRoleId.value)
  isLoading.value = false

  if (success) {
    emit('success')
    closeModal()
  }
}

function closeModal() {
  isOpen.value = false
  username.value = ''
  selectedRoleId.value = ''
}
</script>

<template>
  <UiAppModal v-model:open="isOpen" :title="t('projectMember.invite')">
    <form id="invite-member-form" class="space-y-4" @submit.prevent="handleInvite">
      <UFormField :label="t('projectMember.userUsernameOrId')">
        <UInput
          v-model="username"
          :placeholder="t('projectMember.searchPlaceholder')"
          autofocus
        />
      </UFormField>

      <UFormField :label="t('common.role')">
        <USelectMenu
          v-model="selectedRoleId"
          :items="roleOptions"
          value-attribute="value"
          label-key="label"
          class="w-full"
        />
      </UFormField>
    </form>

    <template #footer>
      <UButton color="neutral" variant="ghost" @click="closeModal">
        {{ t('common.cancel') }}
      </UButton>
      <UButton 
        type="submit" 
        form="invite-member-form" 
        color="primary" 
        :loading="isLoading" 
        :disabled="!username || !selectedRoleId"
      >
        {{ t('projectMember.invite') }}
      </UButton>
    </template>
  </UiAppModal>
</template>
