<script setup lang="ts">
const isSidebarOpen = ref(false)

const { breadcrumbs } = usePageChrome()

function toggleSidebar() {
  isSidebarOpen.value = !isSidebarOpen.value
}

function closeSidebar() {
  isSidebarOpen.value = false
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
    <!-- Header -->
    <LayoutHeader @toggle-sidebar="toggleSidebar" />

    <div class="flex">
      <!-- Sidebar (Desktop) -->
      <aside
        class="hidden lg:block sticky top-0 h-screen w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800"
      >
        <div class="h-full p-4 pt-6">
          <LayoutNavigation />
        </div>
      </aside>

      <!-- Sidebar (Mobile via USlideover) -->
      <USlideover
        v-model:open="isSidebarOpen"
        side="left"
        class="lg:hidden"
      >

        <template #content>
          <div class="flex flex-col h-full bg-white dark:bg-gray-900">
            <!-- Sidebar header (mobile close button) -->
            <div
              class="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-800"
            >
              <span class="text-lg font-semibold text-gray-900 dark:text-white">Menu</span>
              <UButton
                variant="ghost"
                color="neutral"
                icon="i-heroicons-x-mark"
                @click="closeSidebar"
              />
            </div>

            <!-- Navigation -->
            <div class="flex-1 overflow-y-auto p-4 pt-4">
              <LayoutNavigation />
            </div>
          </div>
        </template>
      </USlideover>

      <!-- Main content -->
      <main class="flex-1 min-w-0 pb-20 lg:pb-0">
        <div class="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6">
          <div v-if="breadcrumbs.visible" class="hidden lg:block mb-4">
            <UBreadcrumb :items="breadcrumbs.items" />
          </div>
          <slot />
        </div>
      </main>
    </div>

    <!-- FAB (mobile/tablet) -->
    <CommonGlobalCreateButton mode="fab" class="lg:hidden" />

    <!-- Bottom Navigation (mobile/tablet) -->
    <LayoutBottomNavigation />

    <!-- Global Modals -->
    <UiConfirmUnsavedChanges />
  </div>
</template>

