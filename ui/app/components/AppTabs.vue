<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'

const props = withDefaults(defineProps<{
  items: any[]
  modelValue: string | number
  draggable?: boolean
  activeColor?: any
  inactiveColor?: any
  labelField?: string
}>(), {
  draggable: false,
  activeColor: 'primary',
  inactiveColor: 'neutral',
  labelField: 'label'
})

const emit = defineEmits<{
  'update:modelValue': [id: string | number]
  'update:items': [items: any[]]
}>()

const internalItems = computed({
  get: () => props.items,
  set: (val) => emit('update:items', val)
})

function selectTab(item: any, index: number) {
  // If modelValue is a number, we assume it's an index
  if (typeof props.modelValue === 'number' && !item.id) {
    emit('update:modelValue', index)
  } else {
    emit('update:modelValue', item.id)
  }
}

function isSelected(item: any, index: number) {
  if (typeof props.modelValue === 'number' && !item.id) {
    return props.modelValue === index
  }
  return props.modelValue === item.id
}

function getLabel(item: any) {
  return item[props.labelField] || item.label || item.name || ''
}
</script>

<template>
  <div class="w-full">
    <div class="flex flex-wrap items-center gap-2">
      <!-- We use a wrapper for VueDraggable or a simple div -->
      <template v-if="draggable">
        <VueDraggable
          v-model="internalItems"
          :animation="150"
          class="flex flex-wrap items-center gap-2"
        >
          <div
            v-for="(item, index) in internalItems"
            :key="item.id || index"
            class="shrink-0"
          >
            <slot name="tab" :item="item" :index="index" :selected="isSelected(item, index)" :select="() => selectTab(item, index)">
              <UButton
                :label="getLabel(item)"
                :variant="isSelected(item, index) ? 'soft' : 'ghost'"
                :color="isSelected(item, index) ? activeColor : inactiveColor"
                size="sm"
                class="transition-all duration-200"
                @click="selectTab(item, index)"
              >
                <template v-if="item.icon" #leading>
                  <UIcon :name="item.icon" class="w-4 h-4" />
                </template>
                <template #trailing>
                  <slot name="tab-trailing" :item="item" :index="index" :selected="isSelected(item, index)" />
                </template>
              </UButton>
            </slot>
          </div>
        </VueDraggable>
      </template>
      
      <template v-else>
        <div class="flex flex-wrap items-center gap-2">
          <div
            v-for="(item, index) in internalItems"
            :key="item.id || index"
            class="shrink-0"
          >
            <slot name="tab" :item="item" :index="index" :selected="isSelected(item, index)" :select="() => selectTab(item, index)">
              <UButton
                :label="getLabel(item)"
                :variant="isSelected(item, index) ? 'soft' : 'ghost'"
                :color="isSelected(item, index) ? activeColor : inactiveColor"
                size="sm"
                class="transition-all duration-200"
                @click="selectTab(item, index)"
              >
                <template v-if="item.icon" #leading>
                  <UIcon :name="item.icon" class="w-4 h-4" />
                </template>
                <template #trailing>
                  <slot name="tab-trailing" :item="item" :index="index" :selected="isSelected(item, index)" />
                </template>
              </UButton>
            </slot>
          </div>
        </div>
      </template>

      <!-- Slot for additional actions (like Add button) -->
      <slot name="append" />
    </div>
  </div>
</template>

<style scoped>
@reference "~/assets/css/main.css";

/* Ensure buttons don't shrink too much and look consistent */
.shrink-0 {
  flex-shrink: 0;
}
</style>
