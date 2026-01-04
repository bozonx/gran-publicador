<template>
  <UiCard title="Supabase Connection Status" variant="elevated">
    <div class="space-y-4">
      <div class="flex items-center space-x-2">
        <div :class="['w-3 h-3 rounded-full', isConfigured ? 'bg-green-500' : 'bg-yellow-500']" />
        <span class="text-sm font-medium">
          {{ isConfigured ? 'Configured' : 'Not Configured' }}
        </span>
      </div>

      <div class="text-sm text-gray-600">
        <p v-if="isConfigured"><strong>Supabase URL:</strong> {{ supabaseUrl }}</p>
        <p v-else class="text-yellow-600">
          ⚠️ Please configure SUPABASE_URL and SUPABASE_KEY in .env.development
        </p>
      </div>

      <div v-if="isConfigured" class="pt-4 border-t border-gray-200">
        <p class="text-xs text-gray-500">
          ✅ Supabase client is ready. Database schema will be created in Step 4.
        </p>
      </div>
    </div>
  </UiCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const config = useRuntimeConfig()
const supabaseUrl = config.public.supabase?.url || ''

const isConfigured = computed(() => {
  return supabaseUrl && supabaseUrl !== 'https://your-dev-project.supabase.co'
})
</script>
