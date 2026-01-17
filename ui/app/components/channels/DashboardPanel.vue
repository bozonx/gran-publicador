<script setup lang="ts">
import { useChannels, type SocialMedia } from '~/composables/useChannels'

const { t } = useI18n()
const { 
  channels, 
  fetchChannels, 
  isLoading, 
  getSocialMediaIcon, 
  getSocialMediaColor, 
  getSocialMediaDisplayName 
} = useChannels()

// Fetch all user channels on mount
onMounted(async () => {
    await fetchChannels()
})

const activeChannels = computed(() => {
    return channels.value.filter(c => c.isActive && !c.archivedAt)
})

const totalCount = computed(() => activeChannels.value.length)

const groupedChannels = computed(() => {
    const groups: Record<string, { count: number, socialMedia: SocialMedia }> = {}
    
    activeChannels.value.forEach(channel => {
        if (!groups[channel.socialMedia]) {
            groups[channel.socialMedia] = {
                count: 0,
                socialMedia: channel.socialMedia
            }
        }
        const group = groups[channel.socialMedia]
        if (group) {
            group.count++
        }
    })
    
    return Object.values(groups).sort((a, b) => b.count - a.count)
})
</script>

<template>
    <div class="app-card h-full flex flex-col">
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                {{ t('channel.titlePlural') }}
                <CommonCountBadge :count="totalCount" :title="t('channel.channelsCount')" />
            </h2>
            <UButton variant="ghost" color="primary" size="sm" to="/channels">
                {{ t('common.viewAll') }}
            </UButton>
        </div>
        
        <div class="p-6 flex-1 overflow-y-auto">
            <!-- Loading -->
            <div v-if="isLoading && channels.length === 0" class="flex items-center justify-center py-8">
                <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 text-gray-400 animate-spin" />
            </div>

            <!-- Empty state -->
            <div v-else-if="activeChannels.length === 0" class="text-center py-8">
                <div class="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                    <UIcon
                        name="i-heroicons-hashtag"
                        class="w-6 h-6 text-gray-400 dark:text-gray-500"
                    />
                </div>
                <p class="text-gray-500 dark:text-gray-400 text-sm">
                    {{ t('channel.noChannelsDescription') }}
                </p>
            </div>

            <!-- Grouped list -->
            <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                <div 
                    v-for="group in groupedChannels" 
                    :key="group.socialMedia"
                    class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                    <div class="flex items-center gap-3">
                        <div 
                            class="w-8 h-8 rounded-full flex items-center justify-center text-white"
                            :style="{ backgroundColor: getSocialMediaColor(group.socialMedia) }"
                        >
                            <UIcon :name="getSocialMediaIcon(group.socialMedia)" class="w-4 h-4" />
                        </div>
                        <span class="font-medium text-gray-900 dark:text-white text-sm">
                            {{ getSocialMediaDisplayName(group.socialMedia) }}
                        </span>
                    </div>
                    <CommonCountBadge 
                        :count="group.count" 
                        color="neutral" 
                        variant="solid" 
                    />
                </div>
            </div>
        </div>
    </div>
</template>
