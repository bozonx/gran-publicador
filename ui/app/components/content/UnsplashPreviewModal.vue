<script setup lang="ts">
const props = defineProps<{
  open: boolean
  item: any | null
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'add-to-library'): void
  (e: 'create-publication', item: any): void
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
      <div class="flex-1 min-h-0 bg-gray-50 dark:bg-gray-900 rounded-xl overflow-hidden flex items-center justify-center relative">
        <img 
          v-if="photoUrl" 
          :src="photoUrl" 
          :alt="title || 'Unsplash photo'"
          class="max-w-full max-h-full object-contain shadow-2xl"
        />
      </div>

      <!-- Sidebar / Details -->
      <div class="w-full md:w-80 shrink-0 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">
        <!-- Main Info -->
        <div class="space-y-6">
          <div class="flex flex-col gap-4">
            <!-- Author Profile Section -->
            <div class="flex items-center gap-3">
              <UAvatar
                v-if="unsplashUser"
                :alt="unsplashUser"
                size="md"
                class="ring-2 ring-gray-100 dark:ring-gray-800"
              />
              <div class="flex flex-col min-w-0">
                <span class="text-sm font-bold text-gray-900 dark:text-white truncate">
                  {{ unsplashUser }}
                </span>
                <span class="text-xs text-gray-500 dark:text-gray-400 truncate">
                  @{{ props.item?._virtual?.unsplashUsername }}
                </span>
              </div>
            </div>

            <div class="flex flex-wrap gap-2">
              <UButton
                :to="`${unsplashUserUrl}?utm_source=gran_publicador&utm_medium=referral`"
                target="_blank"
                icon="i-heroicons-user-circle"
                color="neutral"
                variant="subtle"
                size="xs"
                class="flex-1"
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

            <div class="pt-2 space-y-2">
              <UButton
                block
                icon="i-heroicons-plus-circle"
                color="primary"
                variant="subtle"
                @click="emit('add-to-library')"
              >
                В библиотеку контента
              </UButton>
              <UButton
                block
                icon="i-heroicons-paper-airplane"
                color="primary"
                @click="emit('create-publication', props.item)"
              >
                {{ t('contentLibrary.unsplash.createPublication') }}
              </UButton>
            </div>

            <!-- Description -->
            <div v-if="description" class="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-800">
              <p class="text-sm text-gray-600 dark:text-gray-300 italic leading-relaxed">
                {{ description }}
              </p>
            </div>

            <!-- Stats -->
            <div class="grid grid-cols-2 gap-3 pt-2">
              <div v-if="props.item?._virtual?.views" class="flex flex-col gap-0.5">
                <span class="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Views</span>
                <span class="text-sm font-semibold text-gray-900 dark:text-white">
                  {{ Number(props.item._virtual.views).toLocaleString() }}
                </span>
              </div>
              <div v-if="props.item?._virtual?.downloads" class="flex flex-col gap-0.5">
                <span class="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Downloads</span>
                <span class="text-sm font-semibold text-gray-900 dark:text-white">
                  {{ Number(props.item._virtual.downloads).toLocaleString() }}
                </span>
              </div>
              <div v-if="props.item?._virtual?.likes" class="flex flex-col gap-0.5">
                <span class="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Likes</span>
                <span class="text-sm font-semibold text-gray-900 dark:text-white">
                  {{ Number(props.item._virtual.likes).toLocaleString() }}
                </span>
              </div>
            </div>

            <!-- Tags Section -->
            <div v-if="tags.length > 0" class="space-y-2 pt-2">
              <span class="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Tags</span>
              <div class="flex flex-wrap gap-1.5">
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
