<script setup lang="ts">
interface TreeNode {
  label: string
  value: string
  children?: TreeNode[]
}

interface Props {
  items: TreeNode[]
  disabledIds?: string[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'select', groupId: string): void
}>()

const rootNodes = computed<TreeNode[]>(() => {
  return Array.isArray(props.items) ? props.items : []
})

interface FlatRow {
  label: string
  value: string
  depth: number
  isRoot: boolean
  disabled: boolean
}

const flatRows = computed<FlatRow[]>(() => {
  const out: FlatRow[] = []
  const visit = (node: TreeNode, depth: number, isRoot: boolean) => {
    const isDisabled = Array.isArray(props.disabledIds) && props.disabledIds.includes(node.value)
    out.push({ label: node.label, value: node.value, depth, isRoot, disabled: isDisabled })
    if (!Array.isArray(node.children) || node.children.length === 0) return
    for (const child of node.children) {
      visit(child, depth + 1, false)
    }
  }

  for (const root of rootNodes.value) {
    visit(root, 0, true)
  }

  return out
})

const handleSelectId = (id: string) => {
  if (!id) return
  if (Array.isArray(props.disabledIds) && props.disabledIds.includes(id)) return
  emit('select', id)
}
</script>

<template>
  <div class="space-y-1">
    <div
      v-for="row in flatRows"
      :key="row.value"
      class="flex items-center gap-2"
      :style="{ paddingLeft: `${row.depth * 16}px` }"
    >
      <UIcon
        v-if="row.isRoot"
        name="i-heroicons-folder"
        class="w-4 h-4 text-gray-400"
      />
      <span v-else class="w-4 h-4" />
      <button
        type="button"
        class="flex-1 truncate text-sm py-1 text-left"
        :class="row.disabled ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed' : 'hover:text-primary-600 dark:hover:text-primary-400'"
        :disabled="row.disabled"
        @click="handleSelectId(row.value)"
      >
        {{ row.label }}
      </button>
    </div>
  </div>
</template>
