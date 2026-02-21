<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <div class="flex flex-col h-full bg-gray-950">
    <!-- Header -->
    <div class="flex items-center px-3 py-2 border-b border-gray-700 shrink-0">
      <span class="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        {{ t('granVideoEditor.monitor.title', 'Monitor') }}
      </span>
    </div>

    <!-- Video area -->
    <div class="flex-1 flex items-center justify-center">
      <div class="flex flex-col items-center gap-3 text-gray-700">
        <UIcon name="i-heroicons-play-circle" class="w-16 h-16" />
        <p class="text-sm">
          {{ t('granVideoEditor.monitor.empty', 'No clip selected') }}
        </p>
      </div>
    </div>

    <!-- Playback controls -->
    <div class="flex items-center justify-center gap-3 px-4 py-3 border-t border-gray-700 shrink-0">
      <UButton
        size="sm"
        variant="ghost"
        color="neutral"
        icon="i-heroicons-backward"
        :aria-label="t('granVideoEditor.monitor.rewind', 'Rewind')"
        disabled
      />
      <UButton
        size="sm"
        variant="solid"
        color="primary"
        icon="i-heroicons-play"
        :aria-label="t('granVideoEditor.monitor.play', 'Play')"
        disabled
      />
      <UButton
        size="sm"
        variant="ghost"
        color="neutral"
        icon="i-heroicons-forward"
        :aria-label="t('granVideoEditor.monitor.forward', 'Forward')"
        disabled
      />
      <span class="text-xs text-gray-600 ml-2 font-mono">00:00 / 00:00</span>
    </div>
  </div>
</template>
