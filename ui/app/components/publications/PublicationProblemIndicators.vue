<script setup lang="ts">
import type { PublicationProblem } from '~/types/publications'

defineProps<{
  problems: PublicationProblem[]
}>()

const { t } = useI18n()
</script>

<template>
  <div class="flex items-center gap-1.5 flex-wrap">
    <UTooltip 
      v-for="problem in problems" 
      :key="problem.key"
      :text="t(`problems.publication.${problem.key}`, problem.count ? { count: problem.count } : {})"
    >
      <UIcon 
        :name="problem.type === 'critical' ? 'i-heroicons-x-circle' : problem.key === 'publicationExpired' ? 'i-heroicons-clock' : 'i-heroicons-exclamation-triangle'" 
        :class="problem.type === 'critical' ? 'text-red-500' : 'text-orange-500'"
        class="w-4 h-4 shrink-0"
      />
    </UTooltip>
  </div>
</template>
