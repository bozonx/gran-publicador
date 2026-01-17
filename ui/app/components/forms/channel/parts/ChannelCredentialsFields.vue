<script setup lang="ts">
import type { SocialMedia } from '~/types/socialMedia'
import { FORM_SPACING, FORM_STYLES } from '~/utils/design-tokens'

interface Props {
  state: any
  currentSocialMedia: SocialMedia | undefined
}

const { state, currentSocialMedia } = defineProps<Props>()
const { t } = useI18n()
</script>

<template>
  <div class="space-y-4">
    <!-- Telegram credentials -->
    <div v-if="currentSocialMedia === 'TELEGRAM'" class="space-y-4">
      <div class="border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">
        <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <span>{{ t('channel.telegramCredentials', 'Telegram Credentials') }}</span>
          <CommonInfoTooltip :text="t('channel.telegramCredentialsTooltip')" />
        </h3>
      </div>
        
      <div class="space-y-4 pl-4 border-l-2 border-gray-100 dark:border-gray-800">
        <UFormField
          name="credentials.telegramChannelId"
          :label="t('channel.telegramChannelId', 'Channel ID')"
          :help="t('channel.telegramChannelIdHelp', 'Telegram channel ID (e.g., -1001234567890)')"
        >
          <UInput
            v-model="state.credentials.telegramChannelId"
            :placeholder="t('channel.telegramChannelIdPlaceholder', '-1001234567890')"
            class="w-full"
          />
        </UFormField>

        <UFormField
          name="credentials.telegramBotToken"
          :label="t('channel.telegramBotToken', 'Bot Token')"
          :help="t('channel.telegramBotTokenHelp', 'Telegram bot token from @BotFather')"
        >
          <UInput
            v-model="state.credentials.telegramBotToken"
            type="password"
            :placeholder="t('channel.telegramBotTokenPlaceholder', '110201543:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw')"
            class="w-full"
          />
        </UFormField>
      </div>
    </div>

    <!-- VK credentials -->
    <div v-if="currentSocialMedia === 'VK'" class="space-y-4">
        <div class="border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">
        <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100">
          {{ t('channel.vkCredentials', 'VK Credentials') }}
        </h3>
      </div>
        
      <div class="space-y-4 pl-4 border-l-2 border-gray-100 dark:border-gray-800">
        <UFormField
          name="credentials.vkAccessToken"
          :label="t('channel.vkAccessToken', 'Access Token')"
          :help="t('channel.vkAccessTokenHelp', 'Service or user access token for VK API')"
        >
          <UInput
            v-model="state.credentials.vkAccessToken"
            type="password"
            :placeholder="t('channel.vkAccessTokenPlaceholder', 'vk1.a.abc...')"
            class="w-full"
          />
        </UFormField>
      </div>
    </div>
  </div>
</template>
