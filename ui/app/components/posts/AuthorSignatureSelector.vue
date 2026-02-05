<script setup lang="ts">
import type { AuthorSignature, PresetSignature } from '~/types/author-signatures'
import { PRESET_SIGNATURES } from '~/constants/preset-signatures'

interface Props {
  channelId: string | null
  disabled?: boolean
  minimal?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits(['select'])

const { t } = useI18n()
const { user } = useAuth()
const { fetchByChannel } = useAuthorSignatures()

const userSignatures = ref<AuthorSignature[]>([])
const presetSignatures = ref<PresetSignature[]>(PRESET_SIGNATURES)
const isLoading = ref(false)
const selectedValue = ref<string | null>(null)

async function loadSignatures() {
  if (!props.channelId) {
    userSignatures.value = []
    return
  }
  isLoading.value = true
  try {
    const user = await fetchByChannel(props.channelId)
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
  
  if (!props.minimal) {
    // Add "None" option only for non-minimal mode
    list.push({
      value: null,
      label: t('authorSignature.none', 'No signature'),
      icon: 'i-heroicons-no-symbol',
      content: ''
    })
  }
  
  // Add user defined signatures
  if (userSignatures.value.length > 0) {
    list.push({ disabled: true, label: t('authorSignature.user_defined', 'Custom Signatures'), type: 'label' })
    userSignatures.value.forEach(s => {
      const authorName = s.user && s.userId !== user?.value?.id 
        ? ` (${s.user.fullName || s.user.telegramUsername})` 
        : ''
      list.push({
        value: s.id,
        label: s.content.split('\n')[0].slice(0, 50) + (s.isDefault ? ` (${t('authorSignature.is_default', 'Default')})` : '') + authorName,
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
  if (userOpt) return userOpt.content.split('\n')[0].slice(0, 50)
  
  const presetOpt = presetSignatures.value.find(p => p.id === selectedValue.value)
  if (presetOpt) return t(presetOpt.nameKey)
  
  return selectedValue.value // Fallback
})

function handleSelect(item: any) {
  const content = item?.content || ''
  emit('select', content)
  
  if (props.minimal) {
    // Reset selection in minimal mode so trigger remains neutral
    nextTick(() => {
      selectedValue.value = null
    })
  }
}
</script>

<template>
  <div class="space-y-1">
    <USelectMenu
      v-model="selectedValue"
      :items="options"
      value-key="value"
      :disabled="props.disabled || isLoading"
      :loading="isLoading"
      :class="props.minimal ? 'w-auto' : 'w-full'"
      :placeholder="t('authorSignature.select', 'Select author signature...')"
      @update:model-value="(val) => {
        const item = options.find(o => o.value === val)
        handleSelect(item)
      }"
    >
      <!-- @ts-ignore -->
      <template #label>
        <div v-if="props.minimal" class="flex items-center justify-center">
            <UIcon name="i-heroicons-chevron-down" class="w-4 h-4 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" />
        </div>
        <div v-else class="flex items-center gap-2 truncate">
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
