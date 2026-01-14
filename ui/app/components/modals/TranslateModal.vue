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
  (e: 'translated', value: { translatedText: string; provider: string; model?: string; action: 'insert' | 'add' }): void
}>()

const { t } = useI18n()
const { translateText, isLoading, error } = useTranslate()

const targetLang = ref(props.defaultTargetLang || 'ru-RU')
const splitter = ref<'paragraph' | 'markdown' | 'sentence' | 'off'>('paragraph')
const maxChunkLength = ref<number | undefined>(undefined)
const action = ref<'insert' | 'add'>('add')

const languages = [
  { label: 'Russian', value: 'ru-RU' },
  { label: 'English', value: 'en-US' },
  { label: 'Spanish', value: 'es-ES' },
  { label: 'German', value: 'de-DE' },
  { label: 'French', value: 'fr-FR' },
  { label: 'Italian', value: 'it-IT' },
  { label: 'Portuguese', value: 'pt-PT' },
  { label: 'Chinese', value: 'zh-CN' },
  { label: 'Japanese', value: 'ja-JP' },
]

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
      action: action.value,
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
    v-model:open="isOpen"
    :title="t('translate.title')"
    :description="t('sourceTexts.translate')"
  >
    <div class="space-y-4 py-2">
      <UFormGroup :label="t('translate.targetLanguage')">
        <USelectMenu
          v-model="targetLang"
          :items="languages"
          value-key="value"
          label-key="label"
        />
      </UFormGroup>

      <UFormGroup :label="t('translate.splitter')">
        <USelectMenu
          v-model="splitter"
          :items="splitterOptions"
          value-key="value"
          label-key="label"
        />
      </UFormGroup>

      <UFormGroup
        :label="t('translate.maxChunkLength')"
        :help="t('translate.maxChunkLengthHelp')"
      >
        <UInput
          v-model="maxChunkLength"
          type="number"
          placeholder="1000"
        />
      </UFormGroup>

      <UFormGroup :label="t('common.actions')">
        <URadioGroup
          v-model="action"
          :options="[
            { label: t('translate.addAsSourceText'), value: 'add' },
            { label: t('translate.insertAsContent'), value: 'insert' }
          ]"
        />
      </UFormGroup>

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
