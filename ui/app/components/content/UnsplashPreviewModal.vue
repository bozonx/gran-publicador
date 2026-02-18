<script setup lang="ts">
const props = defineProps<{
  open: boolean
  item: any | null
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const { t } = useI18n()

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

const photoUrl = computed(() => props.item?._virtual?.regularUrl)
const unsplashUrl = computed(() => props.item?._virtual?.unsplashUrl)
const unsplashUser = computed(() => props.item?._virtual?.unsplashUser)
const unsplashUserUrl = computed(() => props.item?._virtual?.unsplashUserUrl)
const tags = computed(() => props.item?.tags || [])
const title = computed(() => props.item?.title)
const description = computed(() => props.item?.note)
</script>

<template>
  <UiAppModal 
    v-model:open="isOpen" 
    :title="title || t('contentLibrary.unsplash.photoAlt')" 
    :ui="{ content: 'w-[90vw] max-w-7xl h-[90vh]' }"
  >
    <div class="flex flex-col md:flex-row h-full gap-6 overflow-hidden">
      <!-- Image Section -->
      <div class="flex-1 min-h-0 bg-gray-50 dark:bg-gray-900 rounded-xl overflow-hidden flex items-center justify-center relative group">
        <img 
          v-if="photoUrl" 
          :src="photoUrl" 
          :alt="title || 'Unsplash photo'"
          class="max-w-full max-h-full object-contain shadow-2xl transition-transform duration-500 group-hover:scale-[1.02]"
        />
        
        <!-- Large attribution overlay on hover -->
        <div class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center p-8 pointer-events-none">
          <div class="bg-white/95 dark:bg-gray-900/95 backdrop-blur px-4 py-2 rounded-full shadow-lg text-sm font-medium flex items-center gap-2 pointer-events-auto">
            <span>{{ t('contentLibrary.unsplash.photoBy') }}</span>
            <a 
              :href="`${unsplashUserUrl}?utm_source=gran_publicador&utm_medium=referral`" 
              target="_blank" 
              class="text-primary-600 dark:text-primary-400 hover:underline"
            >
              {{ unsplashUser }}
            </a>
            <span>{{ t('contentLibrary.unsplash.on') }}</span>
            <a 
              :href="`https://unsplash.com/?utm_source=gran_publicador&utm_medium=referral`" 
              target="_blank" 
              class="hover:underline font-bold"
            >
              Unsplash
            </a>
          </div>
        </div>
      </div>

      <!-- Sidebar / Details -->
      <div class="w-full md:w-80 shrink-0 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">
        <!-- Main Info -->
        <div class="space-y-4">
          <div class="flex flex-col gap-2 pt-2">
            <div class="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <UIcon name="i-heroicons-user" class="w-4 h-4" />
              <span>{{ unsplashUser }}</span>
            </div>

            <!-- Description -->
            <div v-if="description" class="text-sm text-gray-600 dark:text-gray-300 italic leading-relaxed pt-2">
              {{ description }}
            </div>

            <!-- Tags Section -->
            <div v-if="tags.length > 0" class="flex flex-wrap gap-1.5 pt-2">
              <UBadge
                v-for="tag in tags"
                :key="tag"
                color="neutral"
                variant="subtle"
                class="rounded-md font-medium px-1.5 py-0.5 text-[10px]"
              >
                {{ tag }}
              </UBadge>
            </div>

            <div class="flex flex-wrap gap-2 pt-4 pb-4 border-b border-gray-100 dark:border-gray-800">
              <UButton
                :to="`${unsplashUserUrl}?utm_source=gran_publicador&utm_medium=referral`"
                target="_blank"
                icon="i-heroicons-user-circle"
                color="neutral"
                variant="subtle"
                size="xs"
              >
                {{ t('contentLibrary.unsplash.viewProfile') }}
              </UButton>
              <UButton
                v-if="unsplashUrl"
                :to="`${unsplashUrl}?utm_source=gran_publicador&utm_medium=referral`"
                target="_blank"
                icon="i-heroicons-arrow-top-right-on-square"
                color="primary"
                variant="subtle"
                size="xs"
              >
                {{ t('contentLibrary.unsplash.openOnUnsplash') }}
              </UButton>
            </div>
          </div>
        </div>



        <!-- License Reminder -->
        <div class="mt-auto p-4 bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-100 dark:border-primary-800/50">
          <div class="flex gap-3">
            <UIcon name="i-heroicons-information-circle" class="w-5 h-5 text-primary-500 shrink-0" />
            <i18n-t keypath="contentLibrary.unsplash.licenseInfo" tag="p" class="text-xs text-primary-700 dark:text-primary-300 leading-relaxed">
              <template #licenseLink>
                <a href="https://unsplash.com/license" target="_blank" class="font-bold underline">{{ t('contentLibrary.unsplash.licenseLink') }}</a>
              </template>
            </i18n-t>
          </div>
        </div>
      </div>
    </div>
  </UiAppModal>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(var(--color-neutral-300), 0.3);
  border-radius: 10px;
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(var(--color-neutral-700), 0.3);
}
</style>
