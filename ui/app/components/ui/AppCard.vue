<script setup lang="ts">
import { CARD_STYLES } from '~/utils/design-tokens'

interface Props {
  title?: string
  description?: string
  padded?: boolean
  titleClass?: string
  descriptionClass?: string
}

withDefaults(defineProps<Props>(), {
  title: undefined,
  description: undefined,
  padded: true,
  titleClass: 'text-lg font-semibold text-gray-900 dark:text-white',
  descriptionClass: 'text-sm text-gray-500 dark:text-gray-400',
})
</script>

<template>
  <div :class="CARD_STYLES.base" class="overflow-hidden">
    <div v-if="title || description || $slots.actions || $slots.badges" :class="[CARD_STYLES.paddingSpacious, CARD_STYLES.borderPrimary]" class="border-b">
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <h2 v-if="title" :class="titleClass">
            {{ title }}
          </h2>
          <p v-if="description" class="mt-1" :class="descriptionClass">
            {{ description }}
          </p>
        </div>

        <div v-if="$slots.actions" class="shrink-0 flex items-center gap-2">
          <slot name="actions" />
        </div>
      </div>

      <div v-if="$slots.badges" class="mt-3 flex flex-wrap gap-2">
        <slot name="badges" />
      </div>
    </div>

    <div :class="padded ? CARD_STYLES.paddingNormal : ''">
      <slot />
    </div>

    <div v-if="$slots.footer" :class="[CARD_STYLES.paddingSpacious, CARD_STYLES.borderPrimary]" class="border-t">
      <slot name="footer" />
    </div>
  </div>
</template>
