<script setup lang="ts">
import LoadingSpinner from '~/components/ui/LoadingSpinner.vue'

interface Props {
  src?: string | null
  srcset?: string | null
  alt?: string
  clickable?: boolean
  size?: 'sm' | 'md' | 'lg'
  boxClass?: string
  imgClass?: string

  pending?: boolean
  isVideo?: boolean

  showStack?: boolean
  totalCount?: number

  error?: boolean
  placeholderIcon?: string
  placeholderText?: string
  errorIcon?: string
  errorText?: string
}

const props = withDefaults(defineProps<Props>(), {
  src: null,
  srcset: null,
  alt: 'Thumb',
  clickable: true,
  size: 'md',
  boxClass: undefined,
  imgClass: undefined,

  pending: undefined,
  isVideo: false,

  showStack: false,
  totalCount: 0,

  error: false,
  placeholderIcon: 'i-heroicons-photo',
  placeholderText: '',
  errorIcon: 'i-heroicons-exclamation-triangle',
  errorText: 'File unavailable',
})

const emit = defineEmits<{
  (e: 'click'): void
  (e: 'load'): void
  (e: 'error'): void
}>()

const localImagePending = ref(!!props.src)
const localImageError = ref(false)

watch(
  () => props.src,
  (next) => {
    localImagePending.value = !!next
    localImageError.value = false
  },
)

const isPending = computed(() => {
  if (props.pending !== undefined) return props.pending
  return localImagePending.value
})

const isError = computed(() => {
  if (props.error) return true
  return localImageError.value
})

const canShowImage = computed(() => {
  if (!props.src) return false
  if (isError.value) return false
  return true
})

const defaultSizeClasses = computed(() => {
  const sizes = {
    sm: 'w-24 h-24',
    md: 'w-48 h-48',
    lg: 'w-64 h-64',
  }
  return sizes[props.size]
})

const boxClasses = computed(() => props.boxClass || defaultSizeClasses.value)

const stackLayerCount = computed(() => {
  if (!props.showStack) return 0
  const count = props.totalCount || 0
  if (count <= 1) return 0
  if (count === 2) return 1
  return 2
})

const stackOffsets = computed(() => {
  return Array.from({ length: stackLayerCount.value }, (_, i) => ({
    right: `${(i + 1) * 4}px`,
    top: `${(i + 1) * 4}px`,
    zIndex: stackLayerCount.value - i,
  }))
})

const badgeText = computed(() => {
  const count = props.totalCount || 0
  if (!props.showStack || count <= 3) return null
  return `${count}`
})

const hasBottomSlot = computed(() => !!useSlots().bottom)

function handleClick() {
  if (!props.clickable) return
  emit('click')
}

function handleLoad() {
  localImagePending.value = false
  emit('load')
}

function handleError() {
  localImagePending.value = false
  localImageError.value = true
  emit('error')
}
</script>

<template>
  <div :class="['relative', boxClasses]">
    <div
      v-for="(offset, index) in stackOffsets"
      :key="`stack-${index}`"
      class="absolute inset-0 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
      :style="{
        transform: `translate(${offset.right}, ${offset.top})`,
        zIndex: offset.zIndex,
      }"
    />

    <div
      :class="[
        boxClasses,
        'border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden group relative',
        isError ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-900/50',
        clickable && 'cursor-pointer hover:border-primary-500 dark:hover:border-primary-400 transition-colors',
      ]"
      style="z-index: 10"
      @click="handleClick"
    >
      <div :class="['absolute inset-0', isError ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-900/50']"></div>

      <div
        v-if="canShowImage && !isPending"
        class="absolute inset-0"
        style="background-image: url('/thumb-checkerboard.svg'); background-size: 32px 32px;"
      ></div>

      <div v-if="canShowImage" class="w-full h-full relative">
        <img
          v-show="!isPending"
          :src="src || undefined"
          :srcset="srcset || undefined"
          :alt="alt"
          :class="['w-full h-full object-cover relative', imgClass]"
          @load="handleLoad"
          @error="handleError"
        />
      </div>

      <div v-if="!canShowImage && !isPending" class="w-full h-full flex flex-col items-center justify-center gap-2 p-4 relative">
        <!-- Background "Plate" for non-error documents/audio -->
        <div
          v-if="!isError"
          class="absolute inset-0 bg-linear-to-br from-gray-100/30 to-gray-200/30 dark:from-gray-800/30 dark:to-gray-900/30 transition-colors group-hover:from-primary-500/5 group-hover:to-primary-500/10"
        ></div>

        <div class="relative flex flex-col items-center justify-center gap-3 w-full transition-transform duration-300 group-hover:scale-105">
           <!-- Decorative glow for icons in plates -->
           <div
            v-if="!isError"
            class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-primary-500/10 dark:bg-primary-400/10 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity"
          ></div>

          <div
            :class="[
              'rounded-2xl flex items-center justify-center transition-all duration-300',
              size === 'sm' ? 'w-12 h-12' : size === 'md' ? 'w-20 h-20' : 'w-24 h-24',
              !isError ? 'bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 group-hover:border-primary-500/30 group-hover:shadow-lg' : ''
            ]"
          >
            <UIcon
              :name="isError ? errorIcon : placeholderIcon"
              :class="[
                size === 'sm' ? 'w-6 h-6' : size === 'md' ? 'w-10 h-10' : 'w-12 h-12',
                isError ? 'text-red-500' : 'text-gray-400 dark:text-gray-500 group-hover:text-primary-500 transition-colors',
              ]"
            />
          </div>

          <p
            v-if="size !== 'sm' && (isError || placeholderText)"
            class="text-xs font-medium text-center truncate w-full px-4 relative"
            :class="isError ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors'"
          >
            {{ isError ? errorText : placeholderText }}
          </p>
        </div>
      </div>

      <div v-if="isPending" class="absolute inset-0 flex items-center justify-center">
        <LoadingSpinner size="lg" color="primary" />
      </div>

      <div
        v-if="isVideo && !isPending && !isError"
        class="absolute inset-0 flex items-center justify-center"
      >
        <img
          src="/thumb-play-overlay.svg"
          alt="Play"
          class="w-16 h-16 opacity-90"
          draggable="false"
        />
      </div>

      <div
        v-if="hasBottomSlot"
        class="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/70 to-transparent p-2"
      >
        <slot name="bottom" />
      </div>

      <slot name="overlay" />

      <slot name="actions" />

      <div
        v-if="badgeText"
        class="absolute top-2 right-2 bg-black/70 text-white text-xs font-semibold px-2 py-1 rounded-full"
      >
        {{ badgeText }}
      </div>
    </div>
  </div>
</template>
