<script setup lang="ts">
const { t } = useI18n()
const { signOut } = useAuth()
const toast = useToast()
const api = useApi()

const isConfirmDeleteOpen = ref(false)
const isDeleting = ref(false)

async function handleDeleteAccount() {
  isDeleting.value = true
  try {
    await api.delete('/users/me')
    toast.add({
      title: t('common.success'),
      description: t('auth.accountDeletedSuccess'),
      color: 'success',
    })
    await signOut()
    navigateTo('/auth/login')
  } catch (err) {
    console.error('Failed to delete account:', err)
    toast.add({
      title: t('common.error'),
      description: t('auth.deleteAccountError'),
      color: 'error',
    })
  } finally {
    isDeleting.value = false
    isConfirmDeleteOpen.value = false
  }
}
</script>

<template>
  <UCard :ui="{ root: 'ring-1 ring-red-200 dark:ring-red-900' }">
    <template #header>
      <h3 class="text-lg font-semibold text-red-600 dark:text-red-400">{{ t('common.danger_zone', 'Danger Zone') }}</h3>
    </template>
    <div class="flex items-center justify-between">
      <div>
        <h3 class="font-medium text-gray-900 dark:text-white">
          {{ t('auth.deleteAccount') }}
        </h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {{ t('auth.delete_warning', 'Once you delete your account, there is no going back. All your data will be permanently removed.') }}
        </p>
      </div>
      <UButton
        color="error"
        variant="solid"
        icon="i-heroicons-trash"
        :loading="isDeleting"
        @click="isConfirmDeleteOpen = true"
      >
        {{ t('auth.deleteAccount') }}
      </UButton>
    </div>

    <!-- Delete Confirmation Modal -->
    <UModal
      v-model:open="isConfirmDeleteOpen"
      :title="t('auth.deleteAccountConfirmTitle')"
      :description="t('auth.deleteAccountConfirmDescription')"
    >
      <template #footer>
        <UButton
          color="neutral"
          variant="ghost"
          @click="isConfirmDeleteOpen = false"
        >
          {{ t('common.cancel') }}
        </UButton>
        <UButton
          color="error"
          :loading="isDeleting"
          @click="handleDeleteAccount"
        >
          {{ t('auth.confirmDelete') }}
        </UButton>
      </template>
    </UModal>
  </UCard>
</template>
