<script setup lang="ts">
const props = defineProps<{
  media: any
  editable?: boolean
}>()

const editableHasSpoiler = defineModel<boolean>('hasSpoiler')
const editableDescription = defineModel<string>('description')
const editableAlt = defineModel<string>('alt')
const editableMetadata = defineModel<any>('metadata')

const { t } = useI18n()
</script>

<template>
  <div v-if="editable" class="w-full space-y-6">
    <div class="p-4 bg-orange-50 dark:bg-orange-900/10 rounded-lg border border-orange-200 dark:border-orange-800/50">
      <UCheckbox
        v-model="editableHasSpoiler"
        :label="t('media.hasSpoiler', 'Hide content (spoiler)')"
        :description="t('media.spoilerDescription', 'Content will be hidden until user clicks')"
        color="warning"
      />
      <div v-if="media.meta?.telegram?.hasSpoiler" class="mt-2 flex items-center gap-1.5 text-xs text-orange-600 dark:text-orange-400">
        <UIcon name="i-heroicons-information-circle" class="w-4 h-4" />
        <span>{{ t('media.originalSpoilerFromTelegram', 'Original message from Telegram had spoiler') }}</span>
      </div>
    </div>

    <div class="space-y-4">
      <UFormField>
        <template #label>
          <div class="flex items-center gap-1.5">
            <span>{{ t('media.description') }}</span>
            <CommonInfoTooltip :text="t('media.descriptionTooltip')" />
          </div>
        </template>
        <UTextarea 
          v-model="editableDescription" 
          :placeholder="t('media.descriptionPlaceholder', 'Description of the media')" 
          :rows="3"
          class="w-full"
        />
      </UFormField>

      <UFormField>
        <template #label>
          <div class="flex items-center gap-1.5">
            <span>{{ t('media.alt') }}</span>
            <CommonInfoTooltip :text="t('media.altTooltip')" />
          </div>
        </template>
        <UInput 
          v-model="editableAlt" 
          :placeholder="t('media.altPlaceholder', 'Alt text for the image')" 
          class="w-full"
        />
      </UFormField>
    </div>

     <div class="mt-4">
        <CommonMetadataEditor
           v-model="editableMetadata"
           :rows="8"
           :disabled="!editable"
        />
     </div>
  </div>
</template>
