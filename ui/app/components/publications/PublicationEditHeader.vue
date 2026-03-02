<script setup lang="ts">
import type { PublicationWithRelations } from '~/types/publications'
import type { PostType, PublicationStatus } from '~/types/posts'
import { ArchiveEntityType } from '~/types/archive.types'
import { getStatusClass, getStatusIcon } from '~/utils/publications'

const props = defineProps<{
  publication: PublicationWithRelations
  project?: any
  isLocked: boolean
  isDesynced: boolean
  isReallyEmpty: boolean
  hasMediaValidationErrors: boolean
  publicationProblems: any[]
  projectTemplates: any[]
  templateOptions: any[]
  channels: any[]
  languageOptions: any[]
  typeOptions: any[]
  isPublishing: boolean
  canPublish: boolean
  statusOptions: any[]
}>()

const emit = defineEmits<{
  (e: 'update-status', status: PublicationStatus): void
  (e: 'open-template-modal'): void
  (e: 'open-relations-modal'): void
  (e: 'open-schedule-modal'): void
  (e: 'publish-now'): void
  (e: 'refresh'): void
}>()

const { t } = useI18n()

const displayStatusOptions = computed(() => {
    const options = [
        { value: 'DRAFT', label: t('publicationStatus.draft') },
        { value: 'READY', label: t('publicationStatus.ready') }
    ]
    if (props.publication && !['DRAFT', 'READY'].includes(props.publication.status)) {
        options.push({
            value: props.publication.status,
            label: props.statusOptions.find(s => s.value === props.publication?.status)?.label || props.publication.status,
            isSystem: true
        } as any)
    }
    return options
})

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-'
  const dObj = new Date(dateString)
  if (isNaN(dObj.getTime())) return '-'
  return dObj.toLocaleString()
}
</script>

<template>
  <div class="space-y-6">
    <!-- Archived Status Banner -->
    <CommonArchivedBanner
        v-if="props.publication.archivedAt"
        :title="t('publication.archived_notice')"
        :description="t('publication.archived_info_banner')"
        :entity-type="ArchiveEntityType.PUBLICATION"
        :entity-id="props.publication.id"
        @restore="emit('refresh')"
    />

    <!-- Problems Banner -->
    <CommonProblemBanner
      v-if="props.publicationProblems.length > 0"
      :problems="props.publicationProblems"
      entity-type="publication"
      class="mb-6"
    />

    <!-- Content Empty Banner -->
    <UAlert
      v-if="props.isReallyEmpty && props.publication.status !== 'DRAFT'"
      color="info"
      variant="soft"
      icon="i-heroicons-information-circle"
      :title="t('publication.validation.contentOrMediaRequired')"
      class="mb-6"
    />

    <!-- Desync Warning Banner -->
    <UAlert
      v-if="props.isDesynced"
      color="warning"
      variant="soft"
      icon="i-heroicons-exclamation-triangle"
      :title="t('publication.desynced_notice')"
      :description="t('publication.desynced_description')"
      class="mb-6"
    />

    <!-- Block 1: Publication Info & Actions (Non-collapsible) -->
    <div class="border border-gray-200 dark:border-gray-700/50 rounded-lg bg-white dark:bg-gray-800/50 shadow-sm">
        <div class="p-6">
            <!-- Metadata Grid -->
            <div class="grid grid-cols-1 md:grid-cols-5 gap-6 text-sm">
                <!-- Zone 1: Status, Project, Language and Type Column (40%) -->
                <div class="space-y-4 md:col-span-2">
                    <!-- Status -->
                    <div>
                        <div class="text-gray-500 dark:text-gray-400 mb-1 text-xs flex items-center gap-1.5">
                            {{ t('post.statusLabel') }}
                            <UPopover :popper="{ placement: 'top' }">
                                <UIcon name="i-heroicons-information-circle" class="w-3.5 h-3.5 text-gray-400 cursor-help hover:text-gray-600 dark:hover:text-gray-300 transition-colors" />
                                <template #content>
                                    <div class="p-3 max-w-xs text-xs whitespace-pre-line">
                                        {{ t('publication.changeStatusWarningReset') }}
                                    </div>
                                </template>
                            </UPopover>
                        </div>
                        <div class="flex items-center gap-2">
                            <div class="inline-flex shadow-sm rounded-md overflow-hidden border border-gray-200 dark:border-gray-700">
                                <UButton
                                    v-for="option in displayStatusOptions"
                                    :key="option.value"
                                    :label="option.label"
                                    color="neutral"
                                    variant="ghost"
                                     :disabled="props.isLocked || ((option as any).isSystem && props.publication?.status === option.value) || (option.value === 'READY' && props.isReallyEmpty)"
                                    class="rounded-none border-r last:border-r-0 border-gray-200 dark:border-gray-700 transition-all px-4 py-2 font-medium"
                                    :class="[
                                        props.publication?.status === option.value 
                                            ? (getStatusClass(option.value as PublicationStatus) + ' opacity-100! shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] disabled:opacity-100! disabled:cursor-default') 
                                            : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 opacity-100'
                                    ]"
                                    @click="emit('update-status', option.value as PublicationStatus)"
                                >
                                    <template v-if="props.publication?.status === option.value" #leading>
                                        <UIcon 
                                            :name="getStatusIcon(option.value as PublicationStatus)" 
                                            class="w-4 h-4" 
                                            :class="{ 'animate-spin': option.value === 'PROCESSING' }"
                                        />
                                    </template>
                                </UButton>
                            </div>
                        </div>
                    </div>

                    <!-- Project and Template Row -->
                    <div class="grid grid-cols-2 gap-4">
                        <!-- Project Selector -->
                        <div>
                            <div class="text-gray-500 dark:text-gray-400 mb-1 text-xs">
                                {{ t('project.title') }}
                            </div>
                            <div v-if="props.publication.projectId" class="flex items-center gap-2">
                                <UIcon name="i-heroicons-folder" class="w-5 h-5 text-gray-400" />
                                <span class="text-gray-900 dark:text-white font-medium text-base truncate">
                                    {{ props.publication.project?.name || t('publication.personal_draft') }}
                                </span>
                            </div>
                            <div v-else>
                                <span class="text-gray-400 italic">{{ t('publication.personal_draft') }}</span>
                            </div>
                        </div>

                        <!-- Template -->
                        <div>
                            <div class="text-gray-500 dark:text-gray-400 mb-1 text-xs">
                                {{ t('projectTemplates.title', 'Publication Template') }}
                            </div>
                            <div class="flex items-center gap-2">
                                <UIcon name="i-heroicons-squares-plus" class="w-5 h-5 text-gray-400" />
                                <span class="text-gray-900 dark:text-white font-medium text-base truncate max-w-37.5">
                                    {{ props.projectTemplates.find(tpl => tpl.id === props.publication?.projectTemplateId)?.name || props.publication?.projectTemplateId || '-' }}
                                </span>
                                <UButton
                                    v-if="!props.isLocked"
                                    icon="i-heroicons-pencil-square"
                                    variant="ghost"
                                    color="neutral"
                                    size="xs"
                                    class="ml-1 text-gray-400 hover:text-primary-500 transition-colors"
                                    @click="emit('open-template-modal')"
                                />
                            </div>
                        </div>
                    </div>

                    <!-- News Source and Language Row -->
                    <div class="grid grid-cols-2 gap-4">
                        <!-- News Source -->
                        <div>
                            <div v-if="props.publication.meta?.newsData?.url">
                                <div class="text-gray-500 dark:text-gray-400 mb-1 text-xs">
                                    {{ t('news.source', 'News Source') }}
                                </div>
                                <div class="flex items-center gap-2">
                                    <UIcon name="i-heroicons-arrow-top-right-on-square" class="w-5 h-5 text-gray-400" />
                                    <a 
                                        :href="props.publication.meta.newsData.url" 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        class="text-info-600 dark:text-info-400 font-medium text-base truncate hover:underline"
                                    >
                                        {{ props.publication.meta.newsData.source || 'Original News' }}
                                    </a>
                                </div>
                            </div>
                            <div v-else class="text-gray-500 dark:text-gray-400 italic text-xs pt-4">
                                {{ t('publication.noNewsSource', 'No news source linked') }}
                            </div>
                        </div>

                        <!-- Language -->
                        <div>
                            <div class="text-gray-500 dark:text-gray-400 mb-1 text-xs">
                                {{ t('common.language') }}
                            </div>
                            <div class="flex items-center gap-2">
                                <UIcon name="i-heroicons-language" class="w-5 h-5 text-gray-400" />
                                <span class="text-gray-900 dark:text-white font-medium text-base">
                                    {{ props.languageOptions.find((l: any) => l.value === props.publication?.language)?.label || props.publication?.language }}
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- Type Row -->
                    <div class="grid grid-cols-2 gap-4">
                        <!-- Type -->
                        <div>
                            <div class="text-gray-500 dark:text-gray-400 mb-1 text-xs">
                                {{ t('post.postType') }}
                            </div>
                            <div class="flex items-center gap-2">
                                <UIcon name="i-heroicons-document-duplicate" class="w-5 h-5 text-gray-400" />
                                <span class="text-gray-900 dark:text-white font-medium text-base">
                                    {{ props.typeOptions.find((t: any) => t.value === props.publication?.postType)?.label || props.publication?.postType }}
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- Relations -->
                    <div>
                        <div class="text-gray-500 dark:text-gray-400 mb-1 text-xs">
                            {{ t('publication.relations.title') }}
                        </div>
                        <div class="flex items-center gap-2">
                            <UIcon name="i-heroicons-link" class="w-5 h-5 text-gray-400" />
                            <template v-if="props.publication?.relations?.length">
                                <UBadge
                                    v-for="rel in props.publication.relations"
                                    :key="rel.id"
                                    :color="rel.type === 'SERIES' ? 'primary' : 'info'"
                                    variant="soft"
                                    size="sm"
                                >
                                    {{ rel.type === 'SERIES' ? t('publication.relations.typeSeries') : t('publication.relations.typeTranslation') }}
                                    ({{ rel.items.length }})
                                </UBadge>
                                <UButton
                                    v-if="!props.isLocked"
                                    icon="i-heroicons-pencil-square"
                                    variant="ghost"
                                    color="neutral"
                                    size="xs"
                                    class="ml-1 text-gray-400 hover:text-primary-500 transition-colors"
                                    @click="emit('open-relations-modal')"
                                />
                            </template>
                            <template v-else>
                                <UButton
                                    v-if="!props.isLocked"
                                    icon="i-heroicons-plus"
                                    variant="soft"
                                    color="primary"
                                    size="xs"
                                    :label="t('publication.relations.add')"
                                    @click="emit('open-relations-modal')"
                                />
                            </template>
                        </div>
                    </div>
                </div>

                <!-- Zone 2: Channels & Scheduler (60%) -->
                <div class="md:col-span-3 flex flex-col gap-6">
                    <!-- Channel Quick Access Block -->
                    <PublicationsChannelQuickAccessBlock
                      v-if="props.publication"
                      :publication="props.publication"
                      :channels="props.channels || []"
                      :disabled="props.isLocked"
                      @refresh="emit('refresh')"
                    />

                    <div class="border-t border-gray-100 dark:border-gray-700/50 pt-2">
                         <div class="text-gray-500 dark:text-gray-400 text-xs mb-1">
                            {{ props.publication.scheduledAt ? t('publication.status.willBePublishedAt') : t('publication.status.scheduling') }}
                         </div>
                         <div class="flex flex-col gap-2 items-start">
                             <div v-if="props.publication.scheduledAt" class="text-gray-900 dark:text-white font-medium flex flex-col">
                                  {{ formatDate(props.publication.scheduledAt) }}
                             </div>

                             <div class="flex flex-row gap-2 mt-1">
                                 <UTooltip :text="props.publication.archivedAt ? t('publication.archived_notice') : (props.isReallyEmpty ? t('publication.validation.contentOrMediaRequired') : (props.hasMediaValidationErrors ? t('publication.validation.fixMediaErrors') : t('publication.scheduleLabel')))">
                                    <UButton
                                        :label="props.publication.scheduledAt ? t('publication.changeSchedule') : t('publication.status.scheduleTime')"
                                        icon="i-heroicons-calendar-days"
                                        variant="soft"
                                        size="xs"
                                        color="primary"
                                         :disabled="props.isLocked || props.isReallyEmpty || props.hasMediaValidationErrors || !!props.publication.archivedAt"
                                        @click="emit('open-schedule-modal')"
                                    ></UButton>
                                 </UTooltip>
                                
                                <UTooltip :text="props.publication.archivedAt ? t('publication.archived_notice') : (!props.publication.posts?.length ? t('publication.noPosts') : (!props.canPublish ? (props.publication.status === 'DRAFT' ? t('publication.validation.draftBlocked') : (props.hasMediaValidationErrors ? t('publication.validation.fixMediaErrors') : t('publication.cannotPublish'))) : ''))">
                                    <UButton
                                        :label="t('publication.publishNow')"
                                        icon="i-heroicons-paper-airplane"
                                        variant="soft"
                                        size="xs"
                                        color="success"
                                        :disabled="!props.canPublish"
                                        :loading="props.isPublishing"
                                        @click="emit('publish-now')"
                                    ></UButton>
                                </UTooltip>
                             </div>
                         </div>
                    </div>
                </div>
            </div>

            <!-- Footer: Creation Info -->
            <div class="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700/50 flex justify-end items-center text-xs text-gray-400">
                <span class="mr-1">{{ t('post.createdAt') }}</span>
                <span>{{ formatDate(props.publication.createdAt) }}</span>
                <template v-if="props.publication.creator">
                    <span class="mx-1">·</span>
                    <span>{{ props.publication.creator.fullName || props.publication.creator.telegramUsername }}</span>
                </template>
            </div>
        </div>
    </div>
  </div>
</template>
