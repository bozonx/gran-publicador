<script setup lang="ts">
import type { TreeItem } from '@nuxt/ui'

interface Props {
  items: TreeItem[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'select', groupId: string): void
}>()

const selected = ref<TreeItem | undefined>(undefined)
const expanded = ref<string[]>([])

const getNodeValue = (node: unknown): string => {
  if (!node || typeof node !== 'object' || !('value' in node)) return ''
  return String((node as any).value ?? '')
}

const collectExpandedIds = (nodes: TreeItem[]): string[] => {
  const out: string[] = []
  const visit = (n: TreeItem) => {
    const id = getNodeValue(n)
    if (id) {
      out.push(id)
    }
    const children = (n as any)?.children as TreeItem[] | undefined
    if (Array.isArray(children)) {
      for (const c of children) visit(c)
    }
  }

  for (const n of nodes) visit(n)
  return Array.from(new Set(out))
}

watch(
  () => props.items,
  (next) => {
    selected.value = undefined
    expanded.value = collectExpandedIds(next ?? [])
  },
  { immediate: true },
)

const handleSelect = (item: TreeItem) => {
  const id = getNodeValue(item)
  if (!id) return
  selected.value = item
  emit('select', id)
}
</script>

<template>
  <UTree
    v-model="selected"
    v-model:expanded="expanded"
    :items="items"
    :get-key="(i: any) => i.value"
    :ui="{ item: 'cursor-pointer' }"
  >
    <template #leading="{ depth }">
      <UIcon
        v-if="depth === 0"
        name="i-heroicons-folder"
        class="w-4 h-4 text-gray-400"
      />
    </template>

    <template #label="{ item }">
      <span class="flex-1 truncate text-sm py-1" @click.stop="handleSelect(item)">
        {{ (item as any).label }}
      </span>
    </template>

    <template #trailing>
      <span />
    </template>
  </UTree>
</template>
