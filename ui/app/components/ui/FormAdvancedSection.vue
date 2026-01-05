<script setup lang="ts">
import { FORM_SPACING, TRANSITION_CLASSES } from '~/utils/design-tokens'

interface Props {
  /** Whether the advanced section is shown */
  modelValue: boolean
  /** Label for show button */
  showLabel?: string
  /** Label for hide button */
  hideLabel?: string
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
}

const props = withDefaults(defineProps<Props>(), {
  showLabel: undefined,
  hideLabel: undefined,
})

const emit = defineEmits<Emits>()

const { t } = useI18n()

function toggle() {
  emit('update:modelValue', !props.modelValue)
}
</script>

<template>
  <div>
    <!-- Toggle button -->
    <div class="flex justify-center">
      <UButton
        variant="outline"
        color="neutral"
        size="sm"
        :icon="modelValue ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
        class="rounded-full"
        @click="toggle"
      >
        {{
          modelValue
            ? (hideLabel || t('post.hideAdvanced', 'Hide advanced options'))
            : (showLabel || t('post.showAdvanced', 'Show advanced options'))
        }}
      </UButton>
    </div>
    
    <!-- Content with transition -->
    <Transition
      :enter-active-class="TRANSITION_CLASSES.enterActive"
      :enter-from-class="TRANSITION_CLASSES.enterFrom"
      :enter-to-class="TRANSITION_CLASSES.enterTo"
      :leave-active-class="TRANSITION_CLASSES.leaveActive"
      :leave-from-class="TRANSITION_CLASSES.leaveFrom"
      :leave-to-class="TRANSITION_CLASSES.leaveTo"
    >
      <div
        v-if="modelValue"
        :class="[FORM_SPACING.sectionDivider, FORM_SPACING.fields, 'mt-2']"
      >
        <slot />
      </div>
    </Transition>
  </div>
</template>
