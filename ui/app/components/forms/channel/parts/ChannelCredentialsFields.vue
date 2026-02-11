<script setup lang="ts">
import type { SocialMedia, PlatformCredentialField } from '@gran/shared/social-media-platforms'
import { getPlatformConfig } from '@gran/shared/social-media-platforms'

interface Props {
  state: any
  currentSocialMedia: SocialMedia | undefined
  hideHeader?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  hideHeader: false
})
const { t } = useI18n()

const credentialFields = computed<PlatformCredentialField[]>(() => {
  if (!props.currentSocialMedia) return []
  return getPlatformConfig(props.currentSocialMedia)?.credentials ?? []
})

function isSensitiveField(key: string): boolean {
  return key.toLowerCase().includes('token') || key.toLowerCase().includes('key')
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="credentialFields.length > 0" class="space-y-4">
      <div
        v-if="!props.hideHeader"
        class="border-b border-gray-200 dark:border-gray-700 pb-2 mb-4"
      >
        <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100">
          {{ t('channel.credentials', 'Credentials') }}
        </h3>
      </div>

      <div class="space-y-4 pl-4 border-l-2 border-gray-100 dark:border-gray-800">
        <UFormField
          v-for="field in credentialFields"
          :key="field.key"
          :name="`credentials.${field.key}`"
          :label="field.label"
          :required="field.required"
        >
          <UInput
            v-model="props.state.credentials[field.key]"
            :type="isSensitiveField(field.key) ? 'password' : 'text'"
            class="w-full"
          />
        </UFormField>
      </div>
    </div>
  </div>
</template>
