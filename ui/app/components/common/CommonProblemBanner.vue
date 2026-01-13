<script setup lang="ts">
const props = defineProps<{
  problems: Array<{ type: 'critical' | 'warning', key: string, count?: number }>
  entityType: 'publication' | 'channel' | 'project'
  dismissible?: boolean
}>()

const emit = defineEmits<{
  (e: 'dismiss'): void
}>()

const { t } = useI18n()
const route = useRoute()

// Group problems by type
const criticalProblems = computed(() => 
  props.problems.filter(p => p.type === 'critical')
)

const warningProblems = computed(() => 
  props.problems.filter(p => p.type === 'warning')
)

const hasCritical = computed(() => criticalProblems.value.length > 0)
const hasWarning = computed(() => warningProblems.value.length > 0)

function getProblemText(problem: { key: string, count?: number }) {
  const key = `problems.${props.entityType}.${problem.key}`
  return problem.count !== undefined 
    ? t(key, problem.count) 
    : t(key)
}
</script>

<template>
  <div v-if="problems.length > 0" class="space-y-3">
    <!-- Critical Problems Banner -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="transform -translate-y-2 opacity-0"
      enter-to-class="transform translate-y-0 opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="transform translate-y-0 opacity-100"
      leave-to-class="transform -translate-y-2 opacity-0"
    >
      <UAlert
        v-if="hasCritical"
        color="error"
        variant="soft"
        :title="t('problems.critical')"
        :close-button="dismissible ? { icon: 'i-heroicons-x-mark-20-solid', color: 'error', variant: 'link', padded: false } : undefined"
        @close="emit('dismiss')"
      >
        <template #icon>
          <UIcon name="i-heroicons-x-circle" class="w-5 h-5" />
        </template>
        
        <template #description>
          <ul class="list-disc ml-5 space-y-1 mt-2">
            <li v-for="problem in criticalProblems" :key="problem.key" class="text-sm">
              <div class="flex items-center gap-2">
                <span>{{ getProblemText(problem) }}</span>
                <UButton
                  v-if="problem.key === 'noCredentials' && entityType === 'channel' && route.params.id"
                  size="xs"
                  color="error" 
                  variant="soft"
                  :to="`/channels/${route.params.id}/settings#credentials`"
                >
                  {{ t('common.edit') }}
                </UButton>
              </div>
            </li>
          </ul>
        </template>
      </UAlert>
    </Transition>

    <!-- Warning Problems Banner -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="transform -translate-y-2 opacity-0"
      enter-to-class="transform translate-y-0 opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="transform translate-y-0 opacity-100"
      leave-to-class="transform -translate-y-2 opacity-0"
    >
      <UAlert
        v-if="hasWarning"
        color="warning"
        variant="soft"
        :title="t('problems.warning')"
        :close-button="dismissible ? { icon: 'i-heroicons-x-mark-20-solid', color: 'warning', variant: 'link', padded: false } : undefined"
        @close="emit('dismiss')"
      >
        <template #icon>
          <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5" />
        </template>
        
        <template #description>
          <ul class="list-disc ml-5 space-y-1 mt-2">
            <li v-for="problem in warningProblems" :key="problem.key" class="text-sm">
              {{ getProblemText(problem) }}
            </li>
          </ul>
        </template>
      </UAlert>
    </Transition>
  </div>
</template>
