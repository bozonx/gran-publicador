<script setup lang="ts">
import { computed } from 'vue'
import type { ChannelWithProject } from '~/types/channels'

interface Props {
  modelValue: string
  channels: ChannelWithProject[]
}

const props = defineProps<Props>()
const emit = defineEmits(['update:modelValue'])

/**
 * Extract unique languages from channels and sort them
 */
const availableLanguages = computed(() => {
  const langs = props.channels
    .map(c => c.language)
    .filter((v, i, a) => v && a.indexOf(v) === i)
  
  return langs.sort()
})

function selectLanguage(lang: string) {
  emit('update:modelValue', lang)
}
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <UButton
      v-for="lang in availableLanguages"
      :key="lang"
      :label="lang"
      :variant="modelValue === lang ? 'solid' : 'outline'"
      :color="modelValue === lang ? 'primary' : 'neutral'"
      size="sm"
      class="min-w-[60px] justify-center font-mono text-xs"
      @click="selectLanguage(lang)"
    />
    <div v-if="availableLanguages.length === 0" class="text-sm text-neutral-500 italic">
      {{ $t('publication.noLanguagesInProject') }}
    </div>
  </div>
</template>
