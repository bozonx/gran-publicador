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
const isSavingPreferencesSection = ref(false)
const anyPreferencesSaving = computed(() => isSavingPreferencesSection.value)

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
        <UiAppCard
          v-if="canEdit(channel)"
          :title="t('channel.general_settings', 'General Settings')"
          :description="t('channel.general_settings_desc', 'Update your channel name and connection details')"
        >
          
          <FormsChannelUpdateGeneral
            :project-id="projectId"
            :channel="channel"
            autosave
            @success="handleUpdateSuccess"
            @cancel="goBack"
          />
        </UiAppCard>

        <!-- Credentials -->
        <UiAppCard
          v-if="canEdit(channel) && (channel.socialMedia === 'telegram' || channel.socialMedia === 'vk')"
          id="credentials"
          :title="channel.socialMedia === 'telegram' ? t('channel.telegramCredentials', 'Telegram Credentials') : t('channel.vkCredentials', 'VK Credentials')"
          :description="t('channel.credentials_desc', 'Manage connection credentials for this channel')"
        >
          
          <FormsChannelUpdateCredentials
            :channel="channel"
            autosave
            @success="handleUpdateSuccess"
          />
        </UiAppCard>

        <!-- Preferences -->
        <UiAppCard
          v-if="canEdit(channel)"
          :title="t('settings.preferences', 'Preferences')"
          :description="t('channel.preferences_desc', 'Configure channel-specific behavior and notifications')"
        >
          
          <FormsChannelUpdatePreferences
            :channel="channel"
            :disabled="anyPreferencesSaving"
            autosave
            @success="handleUpdateSuccess"
          />
        </UiAppCard>



        <!-- Channel Control -->
        <UiAppCard
          v-if="canEdit(channel)"
          :title="t('channel.control', 'Channel Control')"
          :description="t('channel.control_desc', 'Activate or deactivate this channel for posting')"
        >
          
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
        </UiAppCard>

        <!-- Archive Channel -->
        <UiAppCard
          v-if="canEdit(channel)"
          :title="channel.archivedAt ? t('channel.unarchiveChannel', 'Unarchive Channel') : t('channel.archiveChannel', 'Archive Channel')"
        >

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
        </UiAppCard>

        <!-- Danger Zone -->
        <UiAppCard
          v-if="canDelete(channel)"
          :title="t('common.danger_zone', 'Danger Zone')"
          title-class="text-lg font-semibold text-red-600 dark:text-red-400"
          class="border border-red-200 dark:border-red-900"
        >
          
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
        </UiAppCard>
      </div>
    </div>

    <!-- Delete confirmation modal -->
    <UiConfirmModal
      v-model:open="showDeleteModal"
      :title="t('channel.deleteChannel', 'Delete Channel')"
      :description="t('channel.deleteConfirm', 'Are you sure you want to delete this channel?')"
      :confirm-text="t('common.delete')"
      color="error"
      icon="i-heroicons-exclamation-triangle"
      :loading="isDeleting"
      @confirm="handleDelete"
    />
  </div>
</template>
