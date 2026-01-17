<script setup lang="ts">
import type { AuthorSignature, PresetSignature } from '~/types/author-signatures'

interface Props {
  channelId: string | null
  disabled?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits(['select'])

const { t } = useI18n()
const { fetchByChannel, fetchPresets } = useAuthorSignatures()

const userSignatures = ref<AuthorSignature[]>([])
const presetSignatures = ref<PresetSignature[]>([])
const isLoading = ref(false)
const selectedValue = ref<string | null>(null)

async function loadSignatures() {
  isLoading.value = true
  try {
    const [presets, user] = await Promise.all([
      fetchPresets(),
      props.channelId ? fetchByChannel(props.channelId) : Promise.resolve([])
    ])
    presetSignatures.value = presets
    userSignatures.value = user
  } finally {
    isLoading.value = false
  }
}

watch(() => props.channelId, () => {
  loadSignatures()
}, { immediate: true })

const options = computed(() => {
  const list: any[] = []
  
  // Add \"None\" option
  list.push({
    value: null,
    label: t('authorSignature.none', 'No signature'),
    icon: 'i-heroicons-no-symbol',
    content: ''
  })
  
  // Add user defined signatures
  if (userSignatures.value.length > 0) {
    list.push({ disabled: true, label: t('authorSignature.user_defined', 'Custom Signatures'), type: 'label' })
    userSignatures.value.forEach(s => {
      list.push({
        value: s.id,
        label: s.name + (s.isDefault ? ` (${t('authorSignature.is_default', 'Default')})` : ''),
        icon: 'i-heroicons-pencil-square',
        content: s.content,
        isDefault: s.isDefault
      })
    })
  }
  
  // Add preset signatures
  if (presetSignatures.value.length > 0) {
    list.push({ disabled: true, label: t('authorSignature.presets.title', 'Preset Signatures'), type: 'label' })
    presetSignatures.value.forEach(p => {
      list.push({
        value: p.id,
        label: t(p.nameKey),
        icon: 'i-heroicons-sparkles',
        content: t(p.contentKey)
      })
    })
  }
  
  return list
})

const selectedLabel = computed(() => {
  if (!selectedValue.value) return t('authorSignature.select', 'Select signature...')
  
  const userOpt = userSignatures.value.find(s => s.id === selectedValue.value)
  if (userOpt) return userOpt.name
  
  const presetOpt = presetSignatures.value.find(p => p.id === selectedValue.value)
  if (presetOpt) return t(presetOpt.nameKey)
  
  return selectedValue.value // Fallback
})

function handleSelect(value: string | null) {
  selectedValue.value = value
  const opt = options.value.find(o => o.value === value)
  const content = (opt as any)?.content || ''
  emit('select', content)
}
</script>

<template>
  <div class="space-y-1">
    <USelectMenu
      v-model="selectedValue"
      @update:model-value="handleSelect"
      :items="options"
      value-key="value"
      :disabled="props.disabled || isLoading"
      :loading="isLoading"
      class="w-full"
      :placeholder="t('authorSignature.select', 'Select author signature...')"
    >
      <!-- @ts-ignore -->
      <template #label>
        <div class="flex items-center gap-2 truncate">
          <UIcon v-if="selectedValue === null" name="i-heroicons-no-symbol" class="w-4 h-4 text-gray-400" />
          <UIcon v-else name="i-heroicons-pencil-square" class="w-4 h-4 text-primary-500" />
          <span class="truncate">{{ selectedLabel }}</span>
        </div>
      </template>

      <template #item="{ item }">
        <template v-if="item">
          <div v-if="item.type === 'label'" class="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 dark:bg-gray-800/50 -mx-1">
            {{ item.label }}
          </div>
          <div v-else class="flex items-center gap-2 w-full">
            <UIcon :name="item.icon" class="w-4 h-4" :class="item.value ? 'text-primary-500' : 'text-gray-400'" />
            <div class="flex flex-col min-w-0 flex-1">
              <div class="flex items-center gap-1">
                <span class="truncate">{{ item.label }}</span>
                <UIcon v-if="item.isDefault" name="i-heroicons-star-solid" class="w-3 h-3 text-amber-500 shrink-0" />
              </div>
              <span v-if="item.content" class="text-[10px] text-gray-500 truncate max-w-[200px]">{{ item.content }}</span>
            </div>
          </div>
        </template>
      </template>
    </USelectMenu>
  </div>
</template>
