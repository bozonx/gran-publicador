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
  nameInputRef?: any
}

const props = withDefaults(defineProps<Props>(), {
  showProject: true
})

const { t, d } = useI18n()
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
    <!-- Immutable Details (Edit Mode) -->
    <div v-if="isEditMode" class="mb-6">
      <dl class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-6">
        <!-- Social Media -->
        <div>
          <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
            {{ t('channel.socialMedia') }}
          </dt>
          <dd class="flex items-center gap-2 text-sm text-gray-900 dark:text-white">
            <div 
              class="p-1.5 rounded"
              :style="{ backgroundColor: getSocialMediaColor(channel?.socialMedia || 'TELEGRAM') + '20' }"
            >
              <UIcon 
                :name="getSocialMediaIcon(channel?.socialMedia || 'TELEGRAM')" 
                class="w-5 h-5"
                :style="{ color: getSocialMediaColor(channel?.socialMedia || 'TELEGRAM') }"
              />
            </div>
            <span class="font-medium">{{ socialMediaOptions.find((o) => o.value === channel?.socialMedia)?.label }}</span>
          </dd>
        </div>

        <!-- Project -->
        <div v-if="showProject">
          <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
            {{ t('channel.project') }}
          </dt>
          <dd class="flex items-center gap-2 text-sm text-gray-900 dark:text-white">
            <UIcon name="i-heroicons-briefcase" class="w-5 h-5 text-gray-400" />
            <span>{{ currentProjectName || '-' }}</span>
          </dd>
        </div>

        <!-- Language -->
        <div>
          <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
            {{ t('channel.language') }}
          </dt>
          <dd class="flex items-center gap-2 text-sm text-gray-900 dark:text-white">
            <UIcon name="i-heroicons-language" class="w-5 h-5 text-gray-400" />
            <span>{{ languageOptions.find(o => o.value === channel?.language)?.label || channel?.language }}</span>
          </dd>
        </div>

        <!-- Created At -->
        <div v-if="channel?.createdAt">
          <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
            {{ t('channel.createdAt') }}
          </dt>
          <dd class="text-sm text-gray-900 dark:text-white min-h-[28px] flex items-center">
            {{ d(new Date(channel.createdAt), { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }}
          </dd>
        </div>
      </dl>
      
      <USeparator class="my-6" />
    </div>

    <!-- Create Mode Fields -->
    <template v-if="!isEditMode">
      <!-- Project (read-only) -->
      <CommonFormReadOnlyField
        v-if="showProject"
        :label="t('channel.project')"
        :value="currentProjectName || '-'"
        icon="i-heroicons-briefcase"
      />

      <!-- Channel language -->
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

      <!-- Social media type -->
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
    </template>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      <!-- Channel name -->
      <UFormField 
        name="name" 
        :label="t('channel.name')" 
        required
      >
        <UInput
          :ref="props.nameInputRef"
          v-model="state.name"
          :placeholder="t('channel.namePlaceholder')"
          class="w-full"
          size="lg"
        />
      </UFormField>

      <!-- Channel identifier -->
      <UFormField
        name="channelIdentifier"
        required
        :help="getIdentifierHelp(currentSocialMedia || state.socialMedia)"
      >
        <template #label>
          <span class="inline-flex items-center gap-1.5">
            <span>{{ t('channel.identifier') }}</span>
            <CommonInfoTooltip :text="t('channel.identifierTooltip')" />
          </span>
        </template>
        <UInput
          v-model="state.channelIdentifier"
          :placeholder="getIdentifierPlaceholder(currentSocialMedia || state.socialMedia)"
          class="w-full"
          size="lg"
        />
      </UFormField>
    </div>

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

    <!-- Channel tags (only for edit mode) -->
    <UFormField
      v-if="isEditMode"
      name="tags"
      :label="t('channel.tags', 'Tags')"
      :help="t('channel.tagsHelp', 'Channel tags for publication orientation')"
    >
      <CommonInputTags
        v-model="state.tags"
        :placeholder="t('channel.tagsPlaceholder', 'tag1, tag2, tag3')"
        color="neutral"
        variant="outline"
        class="w-full"
      />
    </UFormField>
  </div>
</template>
