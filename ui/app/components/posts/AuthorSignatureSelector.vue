<script setup lang="ts">
import type { AuthorSignature, PresetSignature } from '~/types/author-signatures'

interface Props {
  modelValue: string | null
  channelId: string | null
  disabled?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()
const { fetchByChannel, fetchPresets } = useAuthorSignatures()

const userSignatures = ref<AuthorSignature[]>([])
const presetSignatures = ref<PresetSignature[]>([])
const isLoading = ref(false)

async function loadSignatures() {
  if (!props.channelId) {
    userSignatures.value = []
    return
  }
  
  isLoading.value = true
  try {
    const [user, presets] = await Promise.all([
      fetchByChannel(props.channelId),
      fetchPresets()
    ])
    userSignatures.value = user
    presetSignatures.value = presets
  } finally {
    isLoading.value = false
  }
}

watch(() => props.channelId, () => {
  loadSignatures()
}, { immediate: true })

const options = computed(() => {
  const list: any[] = []
  
  // Add "None" option
  list.push({
    value: null,
    label: t('authorSignature.none', 'No signature'),
    icon: 'i-heroicons-no-symbol'
  })
  
  // Add user defined signatures
  if (userSignatures.value.length > 0) {
    list.push({ disabled: true, label: t('authorSignature.user_defined', 'Custom Signatures'), type: 'label' })
    userSignatures.value.forEach(s => {
      list.push({
        value: s.id,
        label: s.name + (s.isDefault ? ` (${t('authorSignature.is_default', 'Default')})` : ''),
        icon: 'i-heroicons-pencil-square',
        content: s.content
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
  if (!props.modelValue) return t('authorSignature.none', 'No signature')
  
  const userOpt = userSignatures.value.find(s => s.id === props.modelValue)
  if (userOpt) return userOpt.name
  
  const presetOpt = presetSignatures.value.find(p => p.id === props.modelValue)
  if (presetOpt) return t(presetOpt.nameKey)
  
  return props.modelValue // Fallback
})

const selectedValue = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const currentContent = computed(() => {
  if (!props.modelValue) return null
  const opt = options.value.find(o => o.value === props.modelValue)
  return (opt as any)?.content || null
})
</script>

<template>
  <div class="space-y-1">
    <USelectMenu
      v-model="selectedValue"
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

      <!-- @ts-ignore -->
      <template #item="{ item }">
        <template v-if="item">
          <div v-if="item.type === 'label'" class="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 dark:bg-gray-800/50 -mx-1">
            {{ item.label }}
          </div>
          <div v-else class="flex items-center gap-2 w-full">
            <UIcon :name="item.icon" class="w-4 h-4" :class="item.value ? 'text-primary-500' : 'text-gray-400'" />
            <div class="flex flex-col min-w-0">
              <span class="truncate">{{ item.label }}</span>
              <span v-if="item.content" class="text-[10px] text-gray-500 truncate max-w-[200px]">{{ item.content }}</span>
            </div>
          </div>
        </template>
      </template>
    </USelectMenu>
    
    <div v-if="currentContent" class="mt-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded text-[11px] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 font-mono">
      <div class="font-semibold text-[10px] uppercase mb-0.5 opacity-70">{{ t('authorSignature.preview', 'Preview') }}:</div>
      <div class="whitespace-pre-line">{{ currentContent }}</div>
    </div>
  </div>
</template>
