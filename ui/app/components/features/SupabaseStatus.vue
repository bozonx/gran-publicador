<template>
  <UCard>
    <template #header>
      <h3 class="text-lg font-semibold">{{ $t('settings.supabaseStatus') }}</h3>
    </template>
    <div class="space-y-4">
      <div class="flex items-center space-x-2">
        <div :class="['w-3 h-3 rounded-full', isConfigured ? 'bg-green-500' : 'bg-yellow-500']" />
        <span class="text-sm font-medium">
          {{ isConfigured ? $t('common.success') : $t('common.warning') }}
        </span>
      </div>

      <div class="text-sm text-gray-600">
        <p v-if="isConfigured"><strong>{{ $t('settings.supabaseUrl') }}:</strong> {{ supabaseUrl }}</p>
        <p v-else class="text-yellow-600">
          ⚠️ {{ $t('settings.supabaseConfigHint') }}
        </p>
      </div>

      <div v-if="isConfigured" class="pt-4 border-t border-gray-200">
        <p class="text-xs text-gray-500">
          ✅ {{ $t('settings.supabaseReady') }}
        </p>
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const config = useRuntimeConfig()
const supabaseUrl = config.public.supabase?.url || ''

const isConfigured = computed(() => {
  return supabaseUrl && supabaseUrl !== 'https://your-dev-project.supabase.co'
})
</script>
