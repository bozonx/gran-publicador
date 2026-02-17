<script setup lang="ts">
interface Props {
  count: number
  show?: boolean
}

withDefaults(defineProps<Props>(), {
  show: true
})

const { t } = useI18n()
</script>

<template>
  <div v-if="show" class="flex justify-end">
    <p class="text-xs text-secondary-500 dark:text-secondary-400">
      {{ t('common.found', 'Found') }}: {{ count }}
    </p>
  </div>
</template>
