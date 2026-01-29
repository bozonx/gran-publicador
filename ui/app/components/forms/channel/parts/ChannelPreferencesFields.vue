<script setup lang="ts">
import { FORM_SPACING, FORM_STYLES } from '~/utils/design-tokens'

interface Props {
  state: any
}

const props = defineProps<Props>()
const { t } = useI18n()
</script>

<template>
  <div class="space-y-4">
    <div class="border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">
      <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100">
        {{ t('settings.preferences', 'Preferences') }}
      </h3>
    </div>
    
    <UFormField
      name="preferences.staleChannelsDays"
      :label="t('settings.staleChannelsDays', 'Stale Channels Warning (Days)')"
      :help="t('settings.staleChannelsDaysHelpChannel', 'Show warning if channel has no published posts for this many days. Leave empty to use project default.')"
    >
      <UInput
        v-model.number="state.preferences.staleChannelsDays"
        type="number"
        min="1"
        :placeholder="t('settings.defaultFromProject', 'Default from Project')"
        class="w-full"
      />
    </UFormField>
  </div>
</template>
