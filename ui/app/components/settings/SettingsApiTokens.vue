<script setup lang="ts">
const { t, d } = useI18n()
const toast = useToast()
const api = useApi()

// API Tokens
const {
  tokens,
  loading: tokensLoading,
  fetchTokens,
  createToken,
  updateToken,
  deleteToken,
  copyToken,
} = useApiTokens()

const projects = ref<any[]>([])
const showCreateTokenModal = ref(false)
const showEditTokenModal = ref(false)
const editingToken = ref<any>(null)
const newTokenName = ref('')
const newTokenScope = ref<string[]>([])
const limitToProjects = ref(false)
const visibleTokens = ref<Set<string>>(new Set())
const showDeleteTokenModal = ref(false)
const tokenToDeleteId = ref<string | null>(null)

// Load tokens and projects on mount
onMounted(() => {
  fetchTokens()
  fetchProjects()
})

async function fetchProjects() {
  try {
    projects.value = await api.get('/projects')
  } catch (err) {
    console.error('Failed to fetch projects:', err)
  }
}

// Toggle token visibility
function toggleTokenVisibility(tokenId: string) {
  if (visibleTokens.value.has(tokenId)) {
    visibleTokens.value.delete(tokenId)
  } else {
    visibleTokens.value.add(tokenId)
  }
}

// Create new token
async function handleCreateToken() {
  if (!newTokenName.value.trim()) {
    toast.add({
      title: t('common.error'),
      description: 'Token name is required',
      color: 'error',
    })
    return
  }

  try {
    await createToken({
      name: newTokenName.value,
      scopeProjectIds: limitToProjects.value ? newTokenScope.value : [],
    })
    showCreateTokenModal.value = false
    newTokenName.value = ''
    newTokenScope.value = []
    limitToProjects.value = false
  } catch (err) {
    // Error handled in composable
  }
}

// Edit token
function openEditModal(token: any) {
  editingToken.value = token
  newTokenName.value = token.name
  newTokenScope.value = token.scopeProjectIds || []
  limitToProjects.value = token.scopeProjectIds?.length > 0
  showEditTokenModal.value = true
}

async function handleUpdateToken() {
  if (!editingToken.value || !newTokenName.value.trim()) return

  try {
    await updateToken(editingToken.value.id, {
      name: newTokenName.value,
      scopeProjectIds: limitToProjects.value ? newTokenScope.value : [],
    })
    showEditTokenModal.value = false
    editingToken.value = null
    newTokenName.value = ''
    newTokenScope.value = []
    limitToProjects.value = false
  } catch (err) {
    // Error handled in composable
  }
}

function handleDeleteToken(tokenId: string) {
  tokenToDeleteId.value = tokenId
  showDeleteTokenModal.value = true
}

async function confirmDeleteToken() {
  if (tokenToDeleteId.value) {
    try {
      await deleteToken(tokenToDeleteId.value)
      showDeleteTokenModal.value = false
      tokenToDeleteId.value = null
    } catch (err) {
      // Error is handled in useApiTokens
    }
  }
}

// Format scope display
function formatScope(scopeProjectIds: string[]) {
  if (!scopeProjectIds || scopeProjectIds.length === 0) {
    return t('settings.allProjects', 'All projects')
  }
  const projectNames = scopeProjectIds
    .map((id) => projects.value?.find((p: any) => p.id === id)?.name)
    .filter(Boolean)
  return projectNames.join(', ') || t('settings.selectedProjects', 'Selected projects')
}

// Format date helper
function formatDate(date: string | null | undefined): string {
  if (!date) return '—'
  return d(new Date(date), 'long')
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-medium text-gray-900 dark:text-white">
          API Tokens
        </h2>
        <UButton
          color="primary"
          size="sm"
          icon="i-heroicons-plus"
          @click="showCreateTokenModal = true"
        >
          {{ t('settings.createToken', 'Create Token') }}
        </UButton>
      </div>
    </template>

    <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
      {{ t('settings.apiTokensDescription', 'Manage API tokens for external integrations') }}
    </p>

    <div v-if="tokensLoading" class="space-y-3">
      <USkeleton class="h-16 w-full" v-for="i in 2" :key="i" />
    </div>

    <div v-else-if="tokens.length === 0" class="text-center py-8">
      <UIcon name="i-heroicons-key" class="w-12 h-12 mx-auto text-gray-400 mb-2" />
      <p class="text-sm text-gray-500 dark:text-gray-400">
        {{ t('settings.noTokens', 'No API tokens yet') }}
      </p>
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="token in tokens"
        :key="token.id"
        class="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
      >
        <div class="flex items-start justify-between mb-2">
          <div class="flex-1">
            <h3 class="font-medium text-gray-900 dark:text-white">
              {{ token.name }}
            </h3>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {{ t('settings.scope') }}: {{ formatScope(token.scopeProjectIds) }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-heroicons-pencil"
              @click="openEditModal(token)"
            />
            <UButton
              color="error"
              variant="ghost"
              size="xs"
              icon="i-heroicons-trash"
              @click="handleDeleteToken(token.id)"
            />
          </div>
        </div>

        <div class="flex items-center gap-2 mt-3">
          <div class="flex-1 font-mono text-sm bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded">
            {{ visibleTokens.has(token.id) ? token.plainToken : '••••••••••••••••••••••••' }}
          </div>
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            :icon="visibleTokens.has(token.id) ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
            @click="toggleTokenVisibility(token.id)"
          />
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            icon="i-heroicons-clipboard-document"
            @click="copyToken(token.plainToken)"
          />
        </div>

        <div class="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
          <span>{{ t('settings.created') }}: {{ formatDate(token.createdAt) }}</span>
          <span v-if="token.lastUsedAt">
            {{ t('settings.lastUsed') }}: {{ formatDate(token.lastUsedAt) }}
          </span>
          <span v-else>{{ t('settings.neverUsed', 'Never used') }}</span>
        </div>
      </div>
    </div>

    <!-- Create Token Modal -->
    <UModal 
      v-model:open="showCreateTokenModal" 
      :title="t('settings.createToken', 'Create API Token')"
      :ui="{ content: 'sm:max-w-md' }"
    >
      <template #body>
        <div class="space-y-4">
          <UFormField :label="t('settings.tokenName', 'Token Name')" required>
            <UInput v-model="newTokenName" placeholder="My Integration Token" class="w-full" />
          </UFormField>

          <UFormField>
            <UCheckbox
              v-model="limitToProjects"
              :label="t('settings.limitToProjects', 'Limit to specific projects')"
            />
          </UFormField>

          <UFormField v-if="limitToProjects" :label="t('settings.selectProjects', 'Select Projects')">
            <USelectMenu
              v-model="newTokenScope"
              :items="projects || []"
              label-key="name"
              value-key="id"
              multiple
              placeholder="Select projects..."
              class="w-full"
            />
          </UFormField>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="outline" @click="showCreateTokenModal = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="primary" @click="handleCreateToken" :loading="tokensLoading">
            {{ t('common.create') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Edit Token Modal -->
    <UModal 
      v-model:open="showEditTokenModal" 
      :title="t('settings.editToken', 'Edit API Token')"
      :ui="{ content: 'sm:max-w-md' }"
    >
      <template #body>
        <div class="space-y-4">
          <UFormField :label="t('settings.tokenName', 'Token Name')" required>
            <UInput v-model="newTokenName" class="w-full" />
          </UFormField>

          <UFormField>
            <UCheckbox
              v-model="limitToProjects"
              :label="t('settings.limitToProjects', 'Limit to specific projects')"
            />
          </UFormField>

          <UFormField v-if="limitToProjects" :label="t('settings.selectProjects', 'Select Projects')">
            <USelectMenu
              v-model="newTokenScope"
              :items="projects || []"
              label-key="name"
              value-key="id"
              multiple
              class="w-full"
            />
          </UFormField>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="outline" @click="showEditTokenModal = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="primary" @click="handleUpdateToken" :loading="tokensLoading">
            {{ t('common.save') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Delete Token Confirmation Modal -->
    <UiConfirmModal
      v-model="showDeleteTokenModal"
      :title="t('settings.deleteTokenTitle', 'Delete API Token')"
      :description="t('settings.deleteTokenDescription', 'Are you sure you want to delete this API token? This action cannot be undone.')"
      :confirm-text="t('common.delete')"
      color="error"
      icon="i-heroicons-exclamation-triangle"
      :loading="tokensLoading"
      @confirm="confirmDeleteToken"
    />
  </UCard>
</template>
