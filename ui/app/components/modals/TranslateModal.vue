<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTranslate } from '../../composables/useTranslate'

const props = defineProps<{
  open: boolean
  sourceText: string
  defaultTargetLang?: string
}>()

const isOpen = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'translated', value: { translatedText: string; provider: string; model?: string }): void
}>()

const { t } = useI18n()
const { user } = useAuth()
const { translateText, isLoading, error } = useTranslate()

const targetLang = ref(props.defaultTargetLang || user.value?.language || 'en-US')
const splitter = ref<'paragraph' | 'markdown' | 'sentence' | 'off'>('paragraph')
const maxChunkLength = ref<number | undefined>(undefined)


const splitterOptions = computed(() => [
  { label: t('translate.splitterOptions.paragraph'), value: 'paragraph' },
  { label: t('translate.splitterOptions.markdown'), value: 'markdown' },
  { label: t('translate.splitterOptions.sentence'), value: 'sentence' },
  { label: t('translate.splitterOptions.off'), value: 'off' },
])

async function handleTranslate() {
  try {
    const result = await translateText({
      text: props.sourceText,
      targetLang: targetLang.value,
      splitter: splitter.value,
      maxChunkLength: maxChunkLength.value,
    })

    emit('translated', {
      translatedText: result.translatedText,
      provider: result.provider,
      model: result.model,
    })
    emit('update:open', false)
  } catch (err) {
    // Error is handled by useTranslate
  }
}

watch(() => props.defaultTargetLang, (newVal) => {
  if (newVal) targetLang.value = newVal
})
</script>

<template>
  <UiAppModal
    :title="t('translate.title')"
  >
    <div class="space-y-4 py-2">
      <UFormField :label="t('translate.targetLanguage')">
        <CommonLanguageSelect
          v-model="targetLang"
          mode="all"
          searchable
        />
      </UFormField>

      <UFormField :label="t('translate.splitter')">
        <USelectMenu
          v-model="splitter"
          :items="splitterOptions"
          value-key="value"
          label-key="label"
        />
      </UFormField>

      <UFormField
        :label="t('translate.maxChunkLength')"
        :help="t('translate.maxChunkLengthHelp')"
      >
        <UInput
          v-model="maxChunkLength"
          type="number"
          placeholder="1000"
        />
      </UFormField>


      <div
        v-if="error"
        class="text-red-500 text-sm mt-2"
      >
        {{ error }}
      </div>
    </div>

    <template #footer>
      <UButton
        color="neutral"
        variant="ghost"
        @click="isOpen = false"
      >
        {{ t('translate.cancel') }}
      </UButton>
      <UButton
        color="primary"
        :loading="isLoading"
        @click="handleTranslate"
      >
        {{ t('translate.translateButton') }}
      </UButton>
    </template>
  </UiAppModal>
</template>
