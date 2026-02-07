<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useModalAutoFocus } from '~/composables/useModalAutoFocus'

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

const modalRootRef = ref<HTMLElement | null>(null)
const translateFormRef = ref()

useModalAutoFocus({
  open: isOpen,
  root: modalRootRef,
  candidates: [{ target: () => translateFormRef.value?.$el?.querySelector('button') }],
})

async function handleTranslate() {
  if (!translateFormRef.value) return
  
  try {
    const result = await translateFormRef.value.submit()
    if (result) {
      emit('translated', {
        translatedText: result.translatedText,
        provider: result.provider,
        model: result.model,
      })
      isOpen.value = false
    }
  } catch (err) {
    // Error is handled by TranslateForm
  }
}
</script>

<template>
  <UiAppModal
    v-model:open="isOpen"
    :title="t('translate.title')"
  >
    <div ref="modalRootRef" class="py-2">
      <FormsTranslateForm
        ref="translateFormRef"
        :source-text="sourceText"
        :default-target-lang="defaultTargetLang"
        @translated="(res) => {
          emit('translated', res)
          isOpen = false
        }"
      />
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
        :loading="translateFormRef?.isLoading"
        :disabled="!translateFormRef?.targetLang"
        @click="handleTranslate"
      >
        {{ t('translate.translateButton') }}
      </UButton>
    </template>
  </UiAppModal>
</template>
