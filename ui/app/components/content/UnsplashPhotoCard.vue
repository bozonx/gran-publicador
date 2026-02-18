<script setup lang="ts">
const props = defineProps<{
  item: {
    id: string
    title: string | null
    tags: string[]
    createdAt: string
    _virtual: {
      source: 'unsplash'
      unsplashId: string
      unsplashUser: string
      unsplashUsername: string
      unsplashUserUrl: string
      unsplashUrl: string
      thumbUrl: string
      regularUrl: string
    }
  }
}>()

const { t } = useI18n()

const imageUrl = computed(() => props.item._virtual.regularUrl || props.item._virtual.thumbUrl)
const authorUrl = computed(() => props.item._virtual.unsplashUserUrl)
const photoUrl = computed(() => props.item._virtual.unsplashUrl)
const authorName = computed(() => props.item._virtual.unsplashUser)
const altText = computed(() => props.item.title || t('contentLibrary.unsplash.photoAlt'))

const isImageLoaded = ref(false)
const isImageError = ref(false)

const handleImageLoad = () => { isImageLoaded.value = true }
const handleImageError = () => { isImageError.value = true }

const utmParams = '?utm_source=gran_publicador&utm_medium=referral'
</script>

<template>
  <div class="group relative overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800 aspect-4/3 cursor-default select-none">
    <!-- Skeleton loader -->
    <div
      v-if="!isImageLoaded && !isImageError"
      class="absolute inset-0 animate-pulse bg-gray-200 dark:bg-gray-700"
    />

    <!-- Error state -->
    <div
      v-if="isImageError"
      class="absolute inset-0 flex items-center justify-center text-gray-400"
    >
      <UIcon name="i-heroicons-photo" class="w-8 h-8" />
    </div>

    <!-- Photo -->
    <img
      v-show="isImageLoaded && !isImageError"
      :src="imageUrl"
      :alt="altText"
      class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
      loading="lazy"
      @load="handleImageLoad"
      @error="handleImageError"
    >

    <!-- Hover overlay -->
    <div class="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      <!-- Tags -->
      <div
        v-if="item.tags.length > 0"
        class="absolute top-2 left-2 right-2 flex flex-wrap gap-1"
      >
        <span
          v-for="tag in item.tags.slice(0, 4)"
          :key="tag"
          class="px-1.5 py-0.5 text-xs bg-black/50 text-white rounded-full backdrop-blur-sm truncate max-w-[120px]"
        >
          {{ tag }}
        </span>
      </div>

      <!-- Bottom info -->
      <div class="absolute bottom-0 left-0 right-0 p-3 flex items-end justify-between gap-2">
        <!-- Author -->
        <a
          :href="`${authorUrl}${utmParams}`"
          target="_blank"
          rel="noopener noreferrer"
          class="text-white text-xs font-medium hover:underline truncate flex-1"
          @click.stop
        >
          {{ authorName }}
        </a>

        <!-- Open on Unsplash -->
        <a
          :href="`${photoUrl}${utmParams}`"
          target="_blank"
          rel="noopener noreferrer"
          class="shrink-0 p-1.5 bg-white/20 hover:bg-white/30 rounded-lg backdrop-blur-sm transition-colors"
          :title="t('contentLibrary.unsplash.openOnUnsplash')"
          @click.stop
        >
          <UIcon name="i-heroicons-arrow-top-right-on-square" class="w-3.5 h-3.5 text-white" />
        </a>
      </div>
    </div>
  </div>
</template>
