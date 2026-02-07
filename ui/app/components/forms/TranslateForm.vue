<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTranslate } from '~/composables/useTranslate'

const props = defineProps<{
  sourceText: string
  defaultTargetLang?: string
}>()

const emit = defineEmits<{
  (e: 'translated', value: { translatedText: string; provider: string; model?: string }): void
  (e: 'error', msg: string): void
}>()

const { t } = useI18n()
const { translateText, isLoading, error } = useTranslate()

// Start with undefined/null as requested (user must choose)
const targetLang = ref<string | undefined>(undefined)

async function submit() {
  if (!targetLang.value) return

  try {
    const result = await translateText({
      text: props.sourceText,
      targetLang: targetLang.value,
      splitter: 'markdown', // Hardcoded as requested
    })

    emit('translated', {
      translatedText: result.translatedText,
      provider: result.provider,
      model: result.model,
    })
    return result
  } catch (err: any) {
    emit('error', err.message)
    throw err
  }
}

const languageSelectRef = ref()

defineExpose({
  submit,
  isLoading,
  targetLang,
  error,
  languageSelectRef
})
</script>

<template>
  <div class="space-y-4">
    <UFormField :label="t('translate.targetLanguagePrecise')">
      <CommonLanguageSelect
        ref="languageSelectRef"
        v-model="targetLang"
        mode="all"
        searchable
        :placeholder="t('common.select')"
      />
    </UFormField>

    <div
      v-if="error"
      class="text-red-500 text-sm mt-2"
    >
      {{ error }}
    </div>
  </div>
</template>
