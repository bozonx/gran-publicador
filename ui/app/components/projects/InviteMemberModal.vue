<script setup lang="ts">
import type { Database } from '~/types/database.types'
import { useProjects } from '~/composables/useProjects'

type ProjectRole = Database['public']['Enums']['project_role']

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

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const isLoading = ref(false)
const username = ref('')
const selectedRole = ref<ProjectRole>('viewer')

const roleOptions = computed(() => [
  { label: t('roles.admin'), value: 'admin' },
  { label: t('roles.editor'), value: 'editor' },
  { label: t('roles.viewer'), value: 'viewer' },
])

async function handleInvite() {
  if (!username.value) return

  isLoading.value = true
  const success = await addMember(props.projectId, username.value, selectedRole.value)
  isLoading.value = false

  if (success) {
    emit('success')
    closeModal()
  }
}

function closeModal() {
  isOpen.value = false
  username.value = ''
  selectedRole.value = 'viewer'
}
</script>

<template>
  <UiAppModal v-model:open="isOpen" :title="t('projectMember.invite')">
    <form class="space-y-4" @submit.prevent="handleInvite" id="invite-member-form">
      <UFormField :label="t('projectMember.userUsername', 'Telegram Username')" required>
        <UInput
          v-model="username"
          :placeholder="t('projectMember.searchPlaceholderUsername', '@username')"
          autofocus
          class="w-full"
        />
      </UFormField>

      <UFormField :label="t('common.role')">
        <USelectMenu
          v-model="selectedRole"
          :items="roleOptions"
          value-key="value"
          label-key="label"
          class="w-full"
        />
      </UFormField>
    </form>

    <template #footer>
      <UButton color="neutral" variant="ghost" @click="closeModal">
        {{ t('common.cancel') }}
      </UButton>
      <UButton type="submit" form="invite-member-form" color="primary" :loading="isLoading" :disabled="!username">
        {{ t('projectMember.invite') }}
      </UButton>
    </template>
  </UiAppModal>
</template>
