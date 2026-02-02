<script setup lang="ts">
import type { ChannelWithProject } from '~/types/channels'
import type { SocialMedia } from '~/types/socialMedia'
import { FORM_STYLES } from '~/utils/design-tokens'

interface Props {
  state: any
  isEditMode: boolean
  channel?: ChannelWithProject | null
  projectOptions?: { label: string; value: string }[]
  currentProjectName?: string
  currentSocialMedia?: SocialMedia
  showProject?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showProject: true
})

const { t } = useI18n()
const { languageOptions } = useLanguages()
const {
  socialMediaOptions,
  getSocialMediaIcon,
  getSocialMediaColor,
} = useChannels()

/**
 * Get identifier placeholder based on selected social media
 */
function getIdentifierPlaceholder(socialMedia: SocialMedia | undefined): string {
  const placeholders: Record<SocialMedia, string> = {
    TELEGRAM: '@channel_name',
    VK: 'club123456789',
    YOUTUBE: '@channelhandle',
    TIKTOK: '@username',
    FACEBOOK: 'page_username',
    SITE: 'https://example.com',
  }
  return socialMedia ? placeholders[socialMedia] : t('channel.identifierPlaceholder')

}

/**
 * Get identifier help text based on selected social media
 */
function getIdentifierHelp(socialMedia: SocialMedia | undefined): string {
  const helps: Record<SocialMedia, string> = {
    TELEGRAM: t('channel.identifierHelpTelegram'),
    VK: t('channel.identifierHelpVk'),
    YOUTUBE: t('channel.identifierHelpYoutube'),
    TIKTOK: t('channel.identifierHelpTiktok'),
    FACEBOOK: t('channel.identifierHelpFacebook'),
    SITE: t('channel.identifierHelpSite'),
  }
  return socialMedia ? helps[socialMedia] : t('channel.identifierHelp')
}
</script>

<template>
  <div class="space-y-4">
    <!-- Created date (read-only, edit mode only) -->
    <CommonFormReadOnlyField
      v-if="isEditMode && channel?.createdAt"
      :label="t('channel.createdAt', 'Created At')"
      :value="channel.createdAt"
      :help="t('channel.createdAtHelp', 'The date when this channel was created')"
      format-as-date
    />

    <!-- Project (read-only) -->
    <CommonFormReadOnlyField
      v-if="showProject"
      :label="t('channel.project', 'Project')"
      :value="currentProjectName || '-'"
      icon="i-heroicons-briefcase"
    />

    <!-- Channel language -->
    <div v-if="!isEditMode">
      <UFormField
        name="language"
        :label="t('channel.language')"
        required
        :help="t('channel.languageWarningOnCreate')"
      >
        <CommonLanguageSelect
          v-model="state.language"
          mode="all"
          searchable
          class="w-full"
        />
      </UFormField>
    </div>
    <!-- Display current language for edit mode (read-only) -->
    <CommonFormReadOnlyField
      v-else
      :label="t('channel.language')"
      :value="languageOptions.find(o => o.value === channel?.language)?.label || channel?.language"
      :help="t('channel.languageCannotChange', 'Language cannot be changed after channel creation')"
      icon="i-heroicons-language"
    />

    <!-- Social media type (only for create mode) -->
    <div v-if="!isEditMode">
      <UFormField 
        name="socialMedia"
        :label="t('channel.socialMedia')" 
        required
        :help="t('channel.socialMediaWarningOnCreate')"
      >
        <USelectMenu
          v-model="state.socialMedia"
          :items="socialMediaOptions"
          value-key="value"
          label-key="label"
          class="w-full"
        >
          <template #default>
              <div v-if="state.socialMedia" class="flex items-center gap-2">
                <UIcon :name="getSocialMediaIcon(state.socialMedia)" class="w-4 h-4" />
                <span>{{ socialMediaOptions.find(o => o.value === state.socialMedia)?.label }}</span>
              </div>
              <span v-else class="text-gray-400">{{ t('common.select') }}</span>
          </template>
        </USelectMenu>
      </UFormField>

      <!-- Social media preview -->
      <div
        v-if="state.socialMedia"
        class="mt-2 flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg"
      >
        <div
          class="p-1.5 rounded"
          :style="{ backgroundColor: getSocialMediaColor(state.socialMedia) + '20' }"
        >
          <UIcon
            :name="getSocialMediaIcon(state.socialMedia)"
            class="w-4 h-4"
            :style="{ color: getSocialMediaColor(state.socialMedia) }"
          />
        </div>
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
          {{ socialMediaOptions.find((o) => o.value === state.socialMedia)?.label }}
        </span>
      </div>
    </div>

    <!-- Display current social media for edit mode -->
    <div v-else class="space-y-2">
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {{ t('channel.socialMedia') }}
      </label>
      <div
        class="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
      >
        <div
          class="p-2 rounded"
          :style="{
            backgroundColor: getSocialMediaColor(channel?.socialMedia || 'TELEGRAM') + '20',
          }"
        >
          <UIcon
            :name="getSocialMediaIcon(channel?.socialMedia || 'TELEGRAM')"
            class="w-5 h-5"
            :style="{ color: getSocialMediaColor(channel?.socialMedia || 'TELEGRAM') }"
          />
        </div>
        <span class="font-medium text-gray-900 dark:text-white">
          {{ socialMediaOptions.find((o) => o.value === channel?.socialMedia)?.label }}
        </span>
      </div>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        {{ t('channel.socialMediaCannotChange') }}
      </p>
    </div>

    <!-- Channel name -->
    <UFormField name="name" :label="t('channel.name')" required>
      <UInput
        v-model="state.name"
        :placeholder="t('channel.namePlaceholder')"
        class="w-full"
        size="lg"
      />
    </UFormField>

    <!-- Description -->
    <UFormField name="description" :label="t('channel.description', 'Description')">
      <UTextarea
        v-model="state.description"
        :placeholder="t('channel.descriptionPlaceholder', 'Enter channel description...')"
        class="w-full"
        :rows="3"
        autoresize
      />
    </UFormField>

    <!-- Channel identifier -->
    <UFormField
      name="channelIdentifier"
      required
      :help="getIdentifierHelp(currentSocialMedia || state.socialMedia)"
    >
      <template #label>
        <div class="flex items-center gap-1.5">
          <span>{{ t('channel.identifier') }}</span>
          <CommonInfoTooltip :text="t('channel.identifierTooltip')" />
        </div>
      </template>
      <UInput
        v-model="state.channelIdentifier"
        :placeholder="getIdentifierPlaceholder(currentSocialMedia || state.socialMedia)"
        class="w-full"
      />
    </UFormField>

    <!-- Channel tags (only for edit mode) -->
    <UFormField
      v-if="isEditMode"
      name="tags"
      :label="t('channel.tags', 'Tags')"
      :help="t('channel.tagsHelp', 'Channel tags for publication orientation')"
    >
      <UInput
        v-model="state.tags"
        :placeholder="t('channel.tagsPlaceholder', 'tag1, tag2, tag3')"
        class="w-full"
      />
    </UFormField>
  </div>
</template>
