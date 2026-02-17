<script setup lang="ts">
import { computed } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'

interface TabItem {
  id: string | number
  label?: string
  icon?: string
  [key: string]: any
}

const props = withDefaults(defineProps<{
  items: TabItem[]
  modelValue: string | number | null
  activeColor?: "neutral" | "warning" | "success" | "error" | "info" | "primary" | "secondary"
  inactiveColor?: "neutral" | "warning" | "success" | "error" | "info" | "primary" | "secondary"
  labelField?: string
  draggable?: boolean
  showAddButton?: boolean
}>(), {
  activeColor: 'primary',
  inactiveColor: 'neutral',
  labelField: 'label',
  draggable: true,
  showAddButton: true
})

const emit = defineEmits<{
  'update:modelValue': [id: string | number | null]
  'update:items': [items: any[]]
  'add': []
}>()

const internalItems = computed({
  get: () => props.items,
  set: (val) => emit('update:items', val)
})

function selectTab(item: TabItem) {
  emit('update:modelValue', item.id)
}

function isSelected(item: TabItem) {
  return props.modelValue === item.id
}

function getLabel(item: TabItem) {
  return item[props.labelField] || item.label || ''
}
</script>

<template>
  <div class="inline-flex max-w-full">
    <div class="flex flex-wrap items-center gap-2 min-w-0">
      <VueDraggable
        v-if="draggable"
        v-model="internalItems"
        :animation="200"
        handle=".drag-handle"
        class="flex flex-wrap items-center gap-2"
      >
        <div
          v-for="item in internalItems"
          :key="item.id"
          class="flex items-center gap-1 min-w-0"
        >
          <slot name="tab" :item="item" :selected="isSelected(item)" :select="() => selectTab(item)">
            <UButton
              :color="isSelected(item) ? activeColor : inactiveColor"
              :variant="isSelected(item) ? 'solid' : 'outline'"
              size="sm"
              :icon="item.icon"
              class="drag-handle cursor-pointer max-w-full"
              @click="selectTab(item)"
            >
              <span class="truncate max-w-48 sm:max-w-64">
                {{ getLabel(item) }}
              </span>
            </UButton>
          </slot>
        </div>
      </VueDraggable>

      <div v-else class="flex flex-wrap items-center gap-2">
        <div
          v-for="item in internalItems"
          :key="item.id"
          class="flex items-center gap-1 min-w-0"
        >
          <slot name="tab" :item="item" :selected="isSelected(item)" :select="() => selectTab(item)">
            <UButton
              :color="isSelected(item) ? activeColor : inactiveColor"
              :variant="isSelected(item) ? 'solid' : 'outline'"
              size="sm"
              :icon="item.icon"
              class="max-w-full"
              @click="selectTab(item)"
            >
              <span class="truncate max-w-48 sm:max-w-64">
                {{ getLabel(item) }}
              </span>
            </UButton>
          </slot>
        </div>
      </div>

      <UButton
        v-if="showAddButton"
        color="neutral"
        variant="outline"
        size="sm"
        icon="i-heroicons-plus"
        class="shrink-0"
        @click="emit('add')"
      />
    </div>
  </div>
</template>

<style scoped>
@reference "~/assets/css/main.css";

.drag-handle {
  touch-action: none;
}
</style>
