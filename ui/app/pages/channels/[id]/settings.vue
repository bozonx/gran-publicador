<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useChannels } from '~/composables/useChannels'
import { ArchiveEntityType } from '~/types/archive.types'

definePageMeta({
  middleware: 'auth',
})

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const { canGoBack, goBack: navigateBack } = useNavigation()

const {
  fetchChannel,
  currentChannel: channel,
  isLoading,
  toggleChannelActive,
  deleteChannel,
  canEdit,
  canDelete,
} = useChannels()

const projectId = computed(() => channel.value?.projectId || '')
const channelId = computed(() => route.params.id as string)

// UI States
const isSaving = ref(false)
const isTogglingActive = ref(false)
const isDeleting = ref(false)
const showDeleteModal = ref(false)
const deleteConfirmationInput = ref('')

// Fetch channel on mount
onMounted(async () => {
  if (channelId.value) {
    await fetchChannel(channelId.value)
    
    // Scroll to hash anchor after data is loaded and rendered
    await nextTick()
    
    const hash = route.hash
    if (hash) {
      const element = document.querySelector(hash)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
  }
})

const isChannelEmpty = computed(() => {
  if (!channel.value) return true
  return (channel.value.postsCount || 0) === 0
})

/**
 * Navigate back to channel details
 */
function goBack() {
  navigateBack()
}

/**
 * Handle channel update success
 */
function handleUpdateSuccess(channel: any) {
  fetchChannel(channelId.value)
}

/**
 * Handle channel activation/deactivation
 */
async function handleToggleActive() {
  if (!channel.value) return
  isTogglingActive.value = true
  try {
    await toggleChannelActive(channel.value.id)
    await fetchChannel(channel.value.id)
  } finally {
    isTogglingActive.value = false
  }
}

/**
 * Open delete confirmation modal
 */
function confirmDelete() {
  if (isChannelEmpty.value) {
    handleDelete()
    return
  }
  deleteConfirmationInput.value = ''
  showDeleteModal.value = true
}

/**
 * Handle channel deletion
 */
async function handleDelete() {
  if (!channel.value) return
  
  const pid = projectId.value // Capture project ID before deletion
  
  isDeleting.value = true
  try {
    const success = await deleteChannel(channel.value.id)
    if (success) {
      router.push(`/projects/${pid}`)
    }
  } finally {
    isDeleting.value = false
    showDeleteModal.value = false
  }
}
</script>

<template>
  <div>
    <!-- Back button -->
    <div class="mb-6">
      <UButton 
        variant="ghost" 
        color="neutral" 
        icon="i-heroicons-arrow-left" 
        :disabled="!canGoBack"
        @click="goBack"
      >
        {{ t('common.back_to_channel', 'Back to Channel') }}
      </UButton>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading && !channel" class="flex items-center justify-center py-12">
      <div class="text-center">
        <UIcon
          name="i-heroicons-arrow-path"
          class="w-8 h-8 text-gray-400 animate-spin mx-auto mb-3"
        />
        <p class="text-gray-500 dark:text-gray-400">{{ t('common.loading') }}</p>
      </div>
    </div>

    <div v-else-if="channel">
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
            {{ t('channel.settings', 'Channel Settings') }}
          </h1>
          <p class="text-gray-500 dark:text-gray-400 mt-1">
            {{ t('channel.settings_description', 'Manage your channel connection and settings') }}
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-8">
        <!-- General Settings -->
        <UCard v-if="canEdit(channel)">
          <template #header>
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ t('channel.general_settings', 'General Settings') }}
            </h2>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ t('channel.general_settings_desc', 'Update your channel name and connection details') }}
            </p>
          </template>
          
          <FormsChannelForm
            :project-id="projectId"
            :channel="channel"
            :visible-sections="['general']"
            @success="handleUpdateSuccess"
            @cancel="goBack"
            hide-header
            hide-cancel
          />
        </UCard>

        <!-- Credentials -->
        <UCard id="credentials" v-if="canEdit(channel) && (channel.socialMedia === 'TELEGRAM' || channel.socialMedia === 'VK')">
          <template #header>
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ channel.socialMedia === 'TELEGRAM' ? t('channel.telegramCredentials', 'Telegram Credentials') : t('channel.vkCredentials', 'VK Credentials') }}
            </h2>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ t('channel.credentials_desc', 'Manage connection credentials for this channel') }}
            </p>
          </template>
          
          <FormsChannelForm
            :project-id="projectId"
            :channel="channel"
            :visible-sections="['credentials']"
            @success="handleUpdateSuccess"
            @cancel="goBack"
            hide-header
            hide-cancel
          />
        </UCard>

        <!-- Preferences -->
        <UCard v-if="canEdit(channel)">
          <template #header>
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ t('settings.preferences', 'Preferences') }}
            </h2>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ t('channel.preferences_desc', 'Configure channel-specific behavior and notifications') }}
            </p>
          </template>
          
          <FormsChannelForm
            :project-id="projectId"
            :channel="channel"
            :visible-sections="['preferences']"
            @success="handleUpdateSuccess"
            @cancel="goBack"
            hide-header
            hide-cancel
          />
        </UCard>
 
        <!-- Channel Control -->
        <UCard v-if="canEdit(channel)">
          <template #header>
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ t('channel.control', 'Channel Control') }}
            </h2>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ t('channel.control_desc', 'Activate or deactivate this channel for posting') }}
            </p>
          </template>
          
          <div class="flex items-center justify-between">
            <div>
              <h3 class="font-medium text-gray-900 dark:text-white">
                {{ channel.isActive ? t('channel.deactivate', 'Deactivate') : t('channel.activate', 'Activate') }}
              </h3>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {{ channel.isActive 
                  ? t('channel.deactivate_warning', 'Deactivating the channel will stop all scheduled posts.') 
                  : t('channel.activate_info', 'Activating the channel will resume posting for scheduled posts.') 
                }}
              </p>
            </div>
            <UButton
              :color="channel.isActive ? 'warning' : 'success'"
              variant="solid"
              :icon="channel.isActive ? 'i-heroicons-pause' : 'i-heroicons-play'"
              :loading="isTogglingActive"
              @click="handleToggleActive"
            >
              {{ channel.isActive ? t('channel.deactivate', 'Deactivate') : t('channel.activate', 'Activate') }}
            </UButton>
          </div>
        </UCard>

        <!-- Archive Channel -->
        <UCard v-if="canEdit(channel)">
          <template #header>
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ channel.archivedAt ? t('channel.unarchiveChannel', 'Unarchive Channel') : t('channel.archiveChannel', 'Archive Channel') }}
            </h2>
          </template>

          <div class="flex items-center justify-between">
            <div>
              <h3 class="font-medium text-gray-900 dark:text-white">
                {{ channel.archivedAt ? t('channel.channelIsArchived', 'Channel is archived') : t('channel.archive_desc', 'Archived channels are hidden from the project but their history is preserved.') }}
              </h3>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {{ channel.archivedAt ? t('channel.unarchive_info', 'Restoring the channel will make it visible again.') : t('channel.archive_info', 'Archive this channel if it is no longer active but you want to keep the data.') }}
              </p>
            </div>
            <UiArchiveButton
              :entity-type="ArchiveEntityType.CHANNEL"
              :entity-id="channel.id"
              :is-archived="!!channel.archivedAt"
              variant="solid"
              @toggle="() => fetchChannel(channelId)"
            />
          </div>
        </UCard>

        <!-- Danger Zone -->
        <UCard v-if="canDelete(channel)" class="border-red-200 dark:border-red-900">
          <template #header>
            <h2 class="text-lg font-semibold text-red-600 dark:text-red-400">
              {{ t('common.danger_zone', 'Danger Zone') }}
            </h2>
          </template>
          
          <div class="flex items-center justify-between">
            <div>
              <h3 class="font-medium text-gray-900 dark:text-white">
                {{ t('channel.deleteChannel', 'Delete Channel') }}
              </h3>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {{ t('channel.delete_warning', 'Once you delete a channel, all its data will be permanently removed. This action cannot be undone.') }}
              </p>
            </div>
            <UButton
              color="error"
              variant="solid"
              icon="i-heroicons-trash"
              :loading="isDeleting"
              @click="confirmDelete"
            >
              {{ t('channel.deleteChannel', 'Delete Channel') }}
            </UButton>
          </div>
        </UCard>
      </div>
    </div>

    <!-- Delete confirmation modal -->
    <UModal v-model:open="showDeleteModal">
      <template #content>
        <div class="p-6">
          <div class="flex items-center gap-4 mb-4">
            <div class="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <UIcon
                name="i-heroicons-exclamation-triangle"
                class="w-6 h-6 text-red-600 dark:text-red-400"
              />
            </div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ t('channel.deleteChannel', 'Delete Channel') }}
            </h3>
          </div>

          <div v-if="channel" class="mb-6">
            <p class="text-gray-600 dark:text-gray-400 mb-2">
              {{ t('channel.deleteConfirmWithInput') }}
              <span class="font-bold text-gray-900 dark:text-white">{{ channel.name }}</span>
            </p>
            <p class="text-sm text-red-500 font-medium">
              {{ t('channel.deleteCascadeInfo') }}
            </p>
          </div>

          <UInput
            v-if="channel"
            v-model="deleteConfirmationInput"
            :placeholder="channel.name"
            class="mb-6"
            autofocus
            @keyup.enter="deleteConfirmationInput === channel.name ? handleDelete() : null"
          />

          <div class="flex justify-end gap-3">
            <UButton color="neutral" variant="ghost" :disabled="isDeleting" @click="showDeleteModal = false">
              {{ t('common.cancel') }}
            </UButton>
            <UButton 
              color="error" 
              :loading="isDeleting" 
              :disabled="!channel || deleteConfirmationInput !== channel.name"
              @click="handleDelete"
            >
              {{ t('common.delete') }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
